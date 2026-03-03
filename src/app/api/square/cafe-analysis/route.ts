import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Cafe vendors to include (since category field is empty, we filter by vendor)
const CAFE_VENDORS = [
  'Yummify',
  'liz jackson',
  'Byron Brownies',
  'Gigi\'s',
  'Gigis',
  'Bread Social',
  'Doughboy',
  'Kijai Kitchen',
  'Yumbar',
  'Breadicine',
  'Love Bites',
  'Wild Octave Organics',
  'Heat Heart Heart',
  'Dippity Doo Dips',
  'Knox & Aya',
  'Citris Bliss Icy Poles',
];

// Vendors to exclude entirely (pies are handled in pie-calculator)
const EXCLUDE_VENDORS = [
  'Byron Bay Gourmet Pies',
  'Byron Gourmet Pies',
];

// Items to exclude by name (be specific to avoid false positives)
// NOTE: Don't exclude 'pie' generically - it blocks Liz Jackson's Pecan Pie, Pumpkin Pie, etc.
const EXCLUDE_ITEMS = [
  'gado gado',
  'samosa',
  'energy roll',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weeks = parseInt(searchParams.get('weeks') || '6');
    const allVendors = searchParams.get('all') === 'true';

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    let dailySales;
    
    if (allVendors) {
      // Fetch ALL vendors (for discovering new cafe vendors)
      dailySales = await prisma.squareDailySales.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          vendorName: { not: null },
        },
        orderBy: { date: 'asc' },
      });
    } else {
      // Build vendor conditions (case-insensitive matching)
      const vendorConditions = CAFE_VENDORS.map(vendor => ({
        vendorName: { contains: vendor, mode: 'insensitive' as const },
      }));

      // Fetch daily sales records for cafe vendors
      dailySales = await prisma.squareDailySales.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          OR: vendorConditions,
        },
        orderBy: { date: 'asc' },
      });
    }

    // Filter out excluded vendors and items
    const excludeVendorsLower = EXCLUDE_VENDORS.map(v => v.toLowerCase());
    const excludeItemsLower = EXCLUDE_ITEMS.map(i => i.toLowerCase());
    
    const filteredSales = dailySales.filter(record => {
      const vendorLower = (record.vendorName || '').toLowerCase();
      const itemLower = record.itemName.toLowerCase();
      const varLower = (record.variationName || '').toLowerCase();
      
      // Exclude pie vendors
      if (excludeVendorsLower.some(v => vendorLower.includes(v))) {
        return false;
      }
      
      // Exclude pie-related items
      if (excludeItemsLower.some(ex => itemLower.includes(ex) || varLower.includes(ex))) {
        return false;
      }
      
      return true;
    });

    if (filteredSales.length === 0) {
      return createSuccessResponse({
        items: [],
        totalItemsSold: 0,
        totalDays: 0,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        vendors: [],
      });
    }

    // Get unique dates to calculate total days
    const uniqueDates = new Set(filteredSales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;

    // Aggregate by variation with vendor info
    const itemMap = new Map<string, {
      id: string;
      name: string;
      variationId: string;
      variationName: string;
      vendorId: string;
      vendorName: string;
      categoryName: string;
      totalSold: number;
      byDayOfWeek: number[];
    }>();

    for (const record of filteredSales) {
      // FIXED: Aggregate by vendor + item name + variation, NOT squareCatalogId
      // squareCatalogId is unreliable (changes, nulls, duplicates cause wrong aggregation)
      const key = `${record.vendorName || 'unknown'}::${record.itemName}::${record.variationName || 'default'}`;

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          id: key,
          name: record.itemName,
          variationId: key,
          variationName: record.variationName || record.itemName,
          vendorId: record.vendorName?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
          vendorName: record.vendorName || 'Unknown Vendor',
          categoryName: record.category || 'Cafe',
          totalSold: 0,
          byDayOfWeek: new Array(7).fill(0),
        });
      }

      const qty = Number(record.quantitySold);
      const data = itemMap.get(key)!;
      data.totalSold += qty;

      const dayOfWeek = new Date(record.date).getDay();
      data.byDayOfWeek[dayOfWeek] += qty;
    }

    // Build items output
    const items = Array.from(itemMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .map(item => {
        const avgPerDay = item.totalSold / totalDays;
        const avgPerWeek = avgPerDay * 7;

        return {
          id: item.id,
          name: item.name,
          variationId: item.variationId,
          variationName: item.variationName,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          categoryName: item.categoryName,
          totalSold: parseFloat(item.totalSold.toFixed(1)),
          avgPerDay: parseFloat(avgPerDay.toFixed(2)),
          avgPerWeek: parseFloat(avgPerWeek.toFixed(1)),
        };
      });

    // Get unique vendors
    const vendors = [...new Set(items.map(i => i.vendorName))].sort();

    // Calculate totals
    const totalItemsSold = filteredSales.reduce((sum, r) => sum + Number(r.quantitySold), 0);

    // Find actual date range from data
    const dates = filteredSales.map(s => s.date);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    return createSuccessResponse({
      items,
      totalItemsSold: parseFloat(totalItemsSold.toFixed(1)),
      totalDays,
      dateRange: {
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0],
      },
      vendors,
      configuredVendors: CAFE_VENDORS,
    });
  } catch (error: any) {
    console.error('❌ Cafe analysis error:', error);
    return createErrorResponse(
      'CAFE_ANALYSIS_ERROR',
      `Failed to analyze cafe sales: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
