import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Debug endpoint to check sales data status - no auth required
export async function GET(request: NextRequest) {
  try {
    // Count total sales aggregate records
    const totalRecords = await prisma.salesAggregate.count();

    // Get date range of existing data
    const dateRange = await prisma.salesAggregate.aggregate({
      _min: { date: true },
      _max: { date: true },
    });

    // Count sales reports
    const reportCount = await prisma.salesReport.count();

    // Get sample of recent data (last 5 records by date)
    const recentSample = await prisma.salesAggregate.findMany({
      select: {
        date: true,
        category: true,
        itemName: true,
        revenue: true,
        quantity: true,
      },
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Get category counts
    const categoryStats = await prisma.salesAggregate.groupBy({
      by: ['category'],
      _count: true,
      _sum: { revenue: true },
      orderBy: { _sum: { revenue: 'desc' } },
      take: 10,
    });

    return createSuccessResponse({
      status: totalRecords > 0 ? 'DATA_EXISTS' : 'NO_DATA',
      salesAggregates: {
        totalRecords,
        dateRange: {
          earliest: dateRange._min.date,
          latest: dateRange._max.date,
        },
      },
      salesReports: {
        count: reportCount,
      },
      recentSample: recentSample.map(r => ({
        date: r.date.toISOString().split('T')[0],
        category: r.category,
        itemName: r.itemName,
        revenue: Number(r.revenue),
        quantity: Number(r.quantity),
      })),
      categoryStats: categoryStats.map(c => ({
        category: c.category,
        recordCount: c._count,
        totalRevenue: Number(c._sum.revenue),
      })),
      message: totalRecords > 0 
        ? `Found ${totalRecords} sales records from ${reportCount} uploaded reports`
        : 'No sales data found. Upload CSV sales reports via /sales to populate charts.',
    });
  } catch (error) {
    console.error('Sales debug error:', error);
    return createErrorResponse('DEBUG_ERROR', `Debug query failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}
