import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Get all shelf statuses
export async function GET(request: NextRequest) {
  try {
    // Get all unique shelf labels with item counts
    const shelves = await prisma.item.groupBy({
      by: ['subcategory'],
      _count: true,
    });

    // Try to get completion status
    let completedShelves: string[] = [];
    try {
      const statuses = await prisma.shelfStatus.findMany({
        where: { completed: true },
        select: { shelfLabel: true },
      });
      completedShelves = statuses.map(s => s.shelfLabel);
    } catch {
      // Table might not exist yet
    }

    const shelfData = shelves
      .filter(s => s.subcategory) // Exclude null
      .map(s => ({
        shelfLabel: s.subcategory!,
        itemCount: s._count,
        completed: completedShelves.includes(s.subcategory!),
      }))
      .sort((a, b) => a.shelfLabel.localeCompare(b.shelfLabel));

    const summary = {
      total: shelfData.length,
      completed: shelfData.filter(s => s.completed).length,
      remaining: shelfData.filter(s => !s.completed).length,
    };

    return createSuccessResponse({
      shelves: shelfData,
      summary,
    });
  } catch (error: any) {
    console.error('Shelf status error:', error);
    return createErrorResponse('SHELF_STATUS_ERROR', error.message, 500);
  }
}

// Mark a shelf as complete/incomplete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shelfLabel, completed } = body;

    if (!shelfLabel) {
      return createErrorResponse('MISSING_SHELF', 'shelfLabel is required', 400);
    }

    // Upsert shelf status
    const result = await prisma.shelfStatus.upsert({
      where: { shelfLabel },
      update: { 
        completed: completed ?? true,
        completedAt: completed ? new Date() : null,
      },
      create: {
        shelfLabel,
        completed: completed ?? true,
        completedAt: completed ? new Date() : null,
      },
    });

    return createSuccessResponse({ success: true, status: result });
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return createErrorResponse(
        'TABLE_NOT_FOUND',
        'ShelfStatus table not found. Run migration first.',
        500
      );
    }
    console.error('Shelf status save error:', error);
    return createErrorResponse('SHELF_STATUS_ERROR', error.message, 500);
  }
}
