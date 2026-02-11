import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Save a decision for an item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, decision, notes } = body;

    if (!itemId) {
      return createErrorResponse('MISSING_ITEM_ID', 'itemId is required', 400);
    }

    if (!['keep', 'remove', 'staple', null].includes(decision)) {
      return createErrorResponse('INVALID_DECISION', 'decision must be keep, remove, staple, or null', 400);
    }

    // Upsert decision
    const result = await prisma.productDecision.upsert({
      where: { itemId },
      update: { 
        decision: decision || 'undecided',
        notes: notes || null,
        updatedAt: new Date(),
      },
      create: {
        itemId,
        decision: decision || 'undecided',
        notes: notes || null,
      },
    });

    return createSuccessResponse({ success: true, decision: result });
  } catch (error: any) {
    // If table doesn't exist, return helpful message
    if (error.message?.includes('does not exist')) {
      return createErrorResponse(
        'TABLE_NOT_FOUND',
        'ProductDecision table not found. Run migration first.',
        500
      );
    }
    console.error('Decision save error:', error);
    return createErrorResponse('DECISION_ERROR', error.message, 500);
  }
}

// Get all decisions (for report)
export async function GET(request: NextRequest) {
  try {
    const decisions = await prisma.productDecision.findMany({
      include: {
        item: {
          select: {
            name: true,
            category: true,
            subcategory: true,
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const summary = {
      total: decisions.length,
      keep: decisions.filter(d => d.decision === 'keep').length,
      remove: decisions.filter(d => d.decision === 'remove').length,
      staple: decisions.filter(d => d.decision === 'staple').length,
    };

    return createSuccessResponse({
      decisions: decisions.map(d => ({
        itemId: d.itemId,
        itemName: d.item?.name || 'Unknown',
        category: d.item?.category,
        shelfLabel: d.item?.subcategory,
        vendorName: d.item?.vendor?.name,
        decision: d.decision,
        notes: d.notes,
        updatedAt: d.updatedAt,
      })),
      summary,
    });
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return createSuccessResponse({ decisions: [], summary: { total: 0, keep: 0, remove: 0, staple: 0 } });
    }
    console.error('Decision fetch error:', error);
    return createErrorResponse('DECISION_ERROR', error.message, 500);
  }
}
