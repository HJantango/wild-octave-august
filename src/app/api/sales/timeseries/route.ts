import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { salesFilterSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(salesFilterSchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { category, itemName, startDate, endDate } = validation.data;

    // Build where clause
    const where: any = {
      category: { not: null }, // Focus on category aggregates for time series
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (category) {
      where.category = category;
    }

    // Get daily sales data
    const dailyData = await prisma.salesAggregate.groupBy({
      by: ['date'],
      where,
      _sum: {
        revenue: true,
        quantity: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Format for charts
    const timeSeries = dailyData.map(day => ({
      date: day.date.toISOString().split('T')[0],
      revenue: day._sum.revenue || 0,
      quantity: day._sum.quantity || 0,
    }));

    // If filtering by category, also get category breakdown by day
    let categoryBreakdown: any[] = [];
    if (!category) {
      const categoryDaily = await prisma.salesAggregate.groupBy({
        by: ['date', 'category'],
        where: {
          ...where,
          category: { not: null },
        },
        _sum: {
          revenue: true,
          quantity: true,
        },
        orderBy: [
          { date: 'asc' },
          { _sum: { revenue: 'desc' } },
        ],
      });

      // Group by date and format
      const categoryByDate = new Map<string, any[]>();
      categoryDaily.forEach(entry => {
        const dateKey = entry.date.toISOString().split('T')[0];
        if (!categoryByDate.has(dateKey)) {
          categoryByDate.set(dateKey, []);
        }
        categoryByDate.get(dateKey)!.push({
          category: entry.category,
          revenue: entry._sum.revenue || 0,
          quantity: entry._sum.quantity || 0,
        });
      });

      categoryBreakdown = Array.from(categoryByDate.entries()).map(([date, categories]) => ({
        date,
        categories: categories.slice(0, 5), // Top 5 categories per day
      }));
    }

    return createSuccessResponse({
      timeSeries,
      categoryBreakdown: categoryBreakdown.slice(0, 30), // Last 30 days max
    });

  } catch (error) {
    console.error('Sales timeseries error:', error);
    return createErrorResponse('TIMESERIES_ERROR', 'Failed to generate sales timeseries', 500);
  }
}

export const dynamic = 'force-dynamic';