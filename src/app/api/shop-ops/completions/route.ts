import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/shop-ops/completions - Get completion history for audits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const completedBy = searchParams.get('completedBy');
    const limit = parseInt(searchParams.get('limit') || '100');

    const whereClause: Record<string, unknown> = {};

    if (taskId) {
      whereClause.taskId = taskId;
    }

    if (startDate && endDate) {
      whereClause.completedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (completedBy) {
      whereClause.completedBy = completedBy;
    }

    const completions = await prisma.shopOpsCompletion.findMany({
      where: whereClause,
      include: {
        task: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
    });

    // Also get summary stats
    const stats = await prisma.shopOpsCompletion.groupBy({
      by: ['completedBy'],
      where: whereClause,
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        completions,
        stats,
        total: completions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching completions:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch completion history' } },
      { status: 500 }
    );
  }
}
