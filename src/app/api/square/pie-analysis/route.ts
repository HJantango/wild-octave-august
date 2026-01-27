import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weeks = parseInt(searchParams.get('weeks') || '6');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Fetch all daily sales records that look like pie items
    const dailySales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        OR: [
          { itemName: { contains: 'pie', mode: 'insensitive' } },
          { itemName: { contains: 'quiche', mode: 'insensitive' } },
          { itemName: { contains: 'sausage roll', mode: 'insensitive' } },
          { itemName: { contains: 'pasty', mode: 'insensitive' } },
          { itemName: { contains: 'pastie', mode: 'insensitive' } },
          { category: { contains: 'pie', mode: 'insensitive' } },
          { category: { contains: 'bakery', mode: 'insensitive' } },
          { category: { contains: 'pastry', mode: 'insensitive' } },
        ],
      },
      orderBy: { date: 'asc' },
    });

    if (dailySales.length === 0) {
      return createSuccessResponse({
        variations: [],
        timeAnalysis: { hourly: [], periods: [], dayOfWeek: [] },
        totalPiesSold: 0,
        totalDays: 0,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      });
    }

    // Get unique dates to calculate total days
    const uniqueDates = new Set(dailySales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;

    // Aggregate by variation (item + variation name)
    const variationMap = new Map<string, {
      name: string;
      totalSold: number;
      byDayOfWeek: number[];
    }>();

    // Day of week aggregation
    const dayOfWeekTotals = new Array(7).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);

    for (const record of dailySales) {
      const key = record.variationName && record.variationName !== ''
        ? `${record.itemName} - ${record.variationName}`
        : record.itemName;

      if (!variationMap.has(key)) {
        variationMap.set(key, {
          name: key,
          totalSold: 0,
          byDayOfWeek: new Array(7).fill(0),
        });
      }

      const qty = Number(record.quantitySold);
      const data = variationMap.get(key)!;
      data.totalSold += qty;

      const dayOfWeek = new Date(record.date).getDay();
      data.byDayOfWeek[dayOfWeek] += qty;
      dayOfWeekTotals[dayOfWeek] += qty;
      dayOfWeekCounts[dayOfWeek]++;
    }

    // Build variations output
    const dayNames: Array<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> =
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const variations = Array.from(variationMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .map(v => {
        const avgPerDay = v.totalSold / totalDays;
        const recommendedDaily: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          // Calculate per-day average based on how many of that weekday occurred in the period
          const weeksInPeriod = Math.max(1, Math.ceil(totalDays / 7));
          recommendedDaily[dayNames[i]] = Math.ceil(v.byDayOfWeek[i] / weeksInPeriod);
        }

        return {
          name: v.name,
          totalSold: parseFloat(v.totalSold.toFixed(1)),
          avgPerDay: parseFloat(avgPerDay.toFixed(1)),
          avgPerDeliveryPeriod: parseFloat((avgPerDay * 3).toFixed(1)), // Assuming 3-day delivery periods
          recommendedDaily,
          peakHours: [], // Not available from daily aggregation
          peakDays: dayNames
            .map((name, i) => ({ name, total: v.byDayOfWeek[i] }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 3)
            .map(d => d.name),
        };
      });

    // Build time analysis
    const dayOfWeekData = dayNames.map((day, i) => ({
      day: day.charAt(0).toUpperCase() + day.slice(1),
      sales: parseFloat(dayOfWeekTotals[i].toFixed(1)),
    }));

    const totalPiesSold = dailySales.reduce((sum, r) => sum + Number(r.quantitySold), 0);

    // Find actual date range from data
    const dates = dailySales.map(s => s.date);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    return createSuccessResponse({
      variations,
      timeAnalysis: {
        hourly: [], // Not available from daily data
        periods: [], // Not available from daily data
        dayOfWeek: dayOfWeekData,
      },
      totalPiesSold: parseFloat(totalPiesSold.toFixed(1)),
      totalDays,
      dateRange: {
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('❌ Pie analysis error:', error);
    return createErrorResponse(
      'PIE_ANALYSIS_ERROR',
      `Failed to analyze pie sales: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
