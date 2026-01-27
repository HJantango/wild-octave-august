import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weeks = parseInt(searchParams.get('weeks') || '6');
    const vendorFilter = searchParams.get('vendor') || null;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Also get data for the previous period for comparison
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - weeks * 7);

    const where: any = {
      date: { gte: prevStartDate, lte: endDate },
    };
    if (vendorFilter) {
      where.vendorName = { contains: vendorFilter, mode: 'insensitive' };
    }

    const dailySales = await prisma.squareDailySales.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (dailySales.length === 0) {
      return createSuccessResponse({
        itemTrends: [],
        categoryTrends: [],
        topMovers: { increasing: [], decreasing: [] },
        weekOverWeek: [],
      });
    }

    // Split into current and previous period
    const midpoint = startDate.getTime();

    // Aggregate by item for current vs previous period
    const itemData = new Map<string, {
      name: string;
      category: string;
      vendor: string;
      currentQty: number;
      prevQty: number;
      currentRevenue: number;
      prevRevenue: number;
      weeklyData: Map<string, number>;
    }>();

    for (const record of dailySales) {
      const key = record.itemName;
      if (!itemData.has(key)) {
        itemData.set(key, {
          name: record.itemName,
          category: record.category || 'Uncategorized',
          vendor: record.vendorName || 'Unknown',
          currentQty: 0,
          prevQty: 0,
          currentRevenue: 0,
          prevRevenue: 0,
          weeklyData: new Map(),
        });
      }

      const data = itemData.get(key)!;
      const qty = Number(record.quantitySold);
      const revenue = record.grossSalesCents / 100;
      const recordTime = new Date(record.date).getTime();

      if (recordTime >= midpoint) {
        data.currentQty += qty;
        data.currentRevenue += revenue;
      } else {
        data.prevQty += qty;
        data.prevRevenue += revenue;
      }

      // Weekly data for chart
      const weekKey = getWeekKey(new Date(record.date));
      data.weeklyData.set(weekKey, (data.weeklyData.get(weekKey) || 0) + qty);
    }

    // Calculate trends per item
    const itemTrends = Array.from(itemData.values())
      .filter(d => d.currentQty > 0 || d.prevQty > 0)
      .map(d => {
        const change = d.prevQty > 0
          ? ((d.currentQty - d.prevQty) / d.prevQty) * 100
          : d.currentQty > 0 ? 100 : 0;

        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (change > 10) trend = 'up';
        else if (change < -10) trend = 'down';

        return {
          name: d.name,
          category: d.category,
          vendor: d.vendor,
          currentQty: parseFloat(d.currentQty.toFixed(1)),
          previousQty: parseFloat(d.prevQty.toFixed(1)),
          change: parseFloat(change.toFixed(1)),
          trend,
          currentRevenue: parseFloat(d.currentRevenue.toFixed(2)),
          avgWeekly: parseFloat((d.currentQty / weeks).toFixed(1)),
          weeklyData: Array.from(d.weeklyData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([week, qty]) => ({ week, qty: parseFloat(qty.toFixed(1)) })),
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Category-level trends
    const categoryData = new Map<string, { current: number; prev: number; revenue: number }>();
    for (const item of itemTrends) {
      const cat = item.category;
      const existing = categoryData.get(cat) || { current: 0, prev: 0, revenue: 0 };
      existing.current += item.currentQty;
      existing.prev += item.previousQty;
      existing.revenue += item.currentRevenue;
      categoryData.set(cat, existing);
    }

    const categoryTrends = Array.from(categoryData.entries())
      .map(([category, data]) => {
        const change = data.prev > 0
          ? ((data.current - data.prev) / data.prev) * 100
          : data.current > 0 ? 100 : 0;

        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (change > 10) trend = 'up';
        else if (change < -10) trend = 'down';

        return {
          category,
          currentQty: parseFloat(data.current.toFixed(1)),
          previousQty: parseFloat(data.prev.toFixed(1)),
          change: parseFloat(change.toFixed(1)),
          trend,
          revenue: parseFloat(data.revenue.toFixed(2)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Top movers
    const topMovers = {
      increasing: itemTrends
        .filter(i => i.trend === 'up' && i.currentQty >= 1)
        .sort((a, b) => b.change - a.change)
        .slice(0, 10),
      decreasing: itemTrends
        .filter(i => i.trend === 'down' && i.previousQty >= 1)
        .sort((a, b) => a.change - b.change)
        .slice(0, 10),
    };

    // Week-over-week totals
    const weekTotals = new Map<string, { qty: number; revenue: number }>();
    for (const item of itemData.values()) {
      for (const [week, qty] of item.weeklyData) {
        const existing = weekTotals.get(week) || { qty: 0, revenue: 0 };
        existing.qty += qty;
        weekTotals.set(week, existing);
      }
    }

    const weekOverWeek = Array.from(weekTotals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, data]) => ({
        week,
        totalQty: parseFloat(data.qty.toFixed(1)),
      }));

    return createSuccessResponse({
      itemTrends: itemTrends.slice(0, 100), // Top 100 by change magnitude
      categoryTrends,
      topMovers,
      weekOverWeek,
      period: {
        current: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
        previous: { start: prevStartDate.toISOString().split('T')[0], end: startDate.toISOString().split('T')[0] },
        weeks,
      },
    });
  } catch (error: any) {
    console.error('❌ Sales trends error:', error);
    return createErrorResponse('TRENDS_ERROR', `Failed to analyze trends: ${error.message}`, 500);
  }
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export const dynamic = 'force-dynamic';
