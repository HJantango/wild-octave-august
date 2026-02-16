import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Default config if none exists in database
const DEFAULT_PIE_CONFIG = {
  // Vendors whose items should ALL appear in pie report
  vendors: ['Byron Bay Gourmet Pies', 'Byron Gourmet Pies'],
  // Specific items to include (from any vendor)
  extraItems: ['samosa', 'samosas'],
  // Items to always exclude (overrides vendor inclusion)
  excludeItems: ['ratatouille'],
};

type PieReportConfig = typeof DEFAULT_PIE_CONFIG;

async function getPieReportConfig(): Promise<PieReportConfig> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'pie-report-config' },
    });
    
    if (setting?.value) {
      const config = setting.value as PieReportConfig;
      return {
        vendors: config.vendors || DEFAULT_PIE_CONFIG.vendors,
        extraItems: config.extraItems || DEFAULT_PIE_CONFIG.extraItems,
        excludeItems: config.excludeItems || DEFAULT_PIE_CONFIG.excludeItems,
      };
    }
  } catch (e) {
    console.warn('Could not load pie report config, using defaults');
  }
  
  return DEFAULT_PIE_CONFIG;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weeks = parseInt(searchParams.get('weeks') || '6');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Load config from database (or use defaults)
    const config = await getPieReportConfig();
    
    // Build vendor name conditions (case-insensitive matching)
    const vendorConditions = config.vendors.map(v => ({
      vendorName: { equals: v, mode: 'insensitive' as const },
    }));
    
    // Build extra item conditions
    const extraItemConditions = config.extraItems.map(item => ({
      itemName: { contains: item, mode: 'insensitive' as const },
    }));

    // Fetch all daily sales records matching our config
    const dailySales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        OR: [
          // All items from specified vendors
          ...vendorConditions,
          // Plus any extra items by name
          ...extraItemConditions,
        ],
      },
      orderBy: { date: 'asc' },
    });

    // Filter out excluded items
    const excludeLower = config.excludeItems.map(e => e.toLowerCase());
    const filteredSales = dailySales.filter(record => {
      const itemLower = record.itemName.toLowerCase();
      const varLower = (record.variationName || '').toLowerCase();
      return !excludeLower.some(ex => itemLower.includes(ex) || varLower.includes(ex));
    });

    if (filteredSales.length === 0) {
      return createSuccessResponse({
        variations: [],
        timeAnalysis: { hourly: [], periods: [], dayOfWeek: [] },
        totalPiesSold: 0,
        totalDays: 0,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        config: { 
          vendors: config.vendors, 
          extraItems: config.extraItems,
          excludeItems: config.excludeItems,
          source: 'vendor-based' 
        },
      });
    }

    // Get unique dates to calculate total days
    const uniqueDates = new Set(filteredSales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;

    // Aggregate by variation (item + variation name)
    const variationMap = new Map<string, {
      name: string;
      vendorName: string | null;
      totalSold: number;
      byDayOfWeek: number[];
    }>();

    // Day of week aggregation
    const dayOfWeekTotals = new Array(7).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);

    for (const record of filteredSales) {
      const key = record.variationName && record.variationName !== ''
        ? `${record.itemName} - ${record.variationName}`
        : record.itemName;

      if (!variationMap.has(key)) {
        variationMap.set(key, {
          name: key,
          vendorName: record.vendorName,
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
          vendorName: v.vendorName,
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

    const totalPiesSold = filteredSales.reduce((sum, r) => sum + Number(r.quantitySold), 0);

    // Find actual date range from data
    const dates = filteredSales.map(s => s.date);
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
      config: { 
        vendors: config.vendors, 
        extraItems: config.extraItems,
        excludeItems: config.excludeItems,
        source: 'vendor-based' 
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
