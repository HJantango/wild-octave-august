import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Vendor patterns - map product names to vendors
const VENDOR_PATTERNS: { vendor: string; vendorName: string; patterns: string[]; deliveryDays: number[] }[] = [
  {
    vendor: 'yomify',
    vendorName: 'Yomify',
    patterns: ['yomify', 'yummify', 'arianne'],
    deliveryDays: [1, 4], // Mon, Thu
  },
  {
    vendor: 'liz-jackson',
    vendorName: 'Liz Jackson',
    patterns: ['liz jackson', 'lj ', 'liz j', 'gf cake', 'gluten free cake'],
    deliveryDays: [2, 5], // Tue, Fri
  },
  {
    vendor: 'love-bites',
    vendorName: 'Love Bites',
    patterns: ['love bite', 'love bites', 'bliss ball', 'protein ball', 'energy ball', 'raw ball'],
    deliveryDays: [2], // Tue
  },
  {
    vendor: 'byron-bay-brownies',
    vendorName: 'Byron Bay Brownies',
    patterns: ['brownie', 'byron brownie', 'bb brownie'],
    deliveryDays: [3], // Wed
  },
  {
    vendor: 'samosas',
    vendorName: 'Marlena (Samosas)',
    patterns: ['samosa'],
    deliveryDays: [1], // Mon
  },
  {
    vendor: 'gigis',
    vendorName: 'Gigis',
    patterns: ['gigi', 'vegan sweet', 'vegan cake', 'vegan slice'],
    deliveryDays: [0], // Sun (fortnightly)
  },
];

// Categories to include for cafe items
const CAFE_CATEGORIES = ['cafe', 'bakery', 'sweets', 'treats', 'cakes', 'pastry'];

// Item name patterns for cafe items (when vendor not matched)
const CAFE_ITEM_PATTERNS = [
  'muffin', 'cookie', 'cake', 'slice', 'brownie', 'ball', 'bar',
  'croissant', 'danish', 'scroll', 'bun', 'sweet', 'treat',
  'tart', 'cupcake', 'donut', 'scone', 'friand'
];

function identifyVendor(itemName: string, category?: string | null): { vendor: string; vendorName: string; deliveryDays: number[] } | null {
  const nameLower = itemName.toLowerCase();
  
  // Check vendor patterns
  for (const { vendor, vendorName, patterns, deliveryDays } of VENDOR_PATTERNS) {
    if (patterns.some(pattern => nameLower.includes(pattern))) {
      return { vendor, vendorName, deliveryDays };
    }
  }
  
  // Check if it's a cafe item by category
  if (category && CAFE_CATEGORIES.some(c => category.toLowerCase().includes(c))) {
    return { vendor: 'other-cafe', vendorName: 'Other Cafe Items', deliveryDays: [] };
  }
  
  // Check if it's a cafe item by name pattern
  if (CAFE_ITEM_PATTERNS.some(pattern => nameLower.includes(pattern))) {
    return { vendor: 'other-cafe', vendorName: 'Other Cafe Items', deliveryDays: [] };
  }
  
  return null;
}

// Calculate days until next delivery
function getDaysUntilDelivery(deliveryDays: number[]): number {
  if (deliveryDays.length === 0) return 7; // Default to weekly if no schedule
  
  const today = new Date().getDay(); // 0=Sun, 1=Mon, etc.
  
  let minDays = 7;
  for (const day of deliveryDays) {
    let diff = day - today;
    if (diff <= 0) diff += 7;
    if (diff < minDays) minDays = diff;
  }
  
  return minDays;
}

// Get the next delivery date
function getNextDeliveryDate(deliveryDays: number[]): string {
  if (deliveryDays.length === 0) return 'As needed';
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  
  let minDays = 7;
  let nextDay = deliveryDays[0];
  
  for (const day of deliveryDays) {
    let diff = day - today;
    if (diff <= 0) diff += 7;
    if (diff < minDays) {
      minDays = diff;
      nextDay = day;
    }
  }
  
  if (minDays === 1) return 'Tomorrow';
  if (minDays === 7) return 'Today';
  return dayNames[nextDay];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeksBack = parseInt(searchParams.get('weeks') || '6');
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksBack * 7));
    
    // Fetch all daily sales records
    const dailySales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
    
    if (dailySales.length === 0) {
      return createSuccessResponse({
        vendors: [],
        summary: { totalItems: 0, totalQtySold: 0, totalRevenue: 0 },
        period: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), weeks: weeksBack },
      });
    }
    
    // Get unique dates and days in period
    const uniqueDates = new Set(dailySales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;
    
    // Aggregate by item and vendor
    const itemMap = new Map<string, {
      itemName: string;
      variationName: string;
      vendor: string;
      vendorName: string;
      deliveryDays: number[];
      totalQty: number;
      totalRevenue: number;
      byDayOfWeek: number[];
    }>();
    
    for (const record of dailySales) {
      const vendorInfo = identifyVendor(record.itemName, record.category);
      if (!vendorInfo) continue; // Skip non-cafe items
      
      const key = `${vendorInfo.vendor}::${record.itemName}::${record.variationName || ''}`;
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemName: record.itemName,
          variationName: record.variationName || '',
          vendor: vendorInfo.vendor,
          vendorName: vendorInfo.vendorName,
          deliveryDays: vendorInfo.deliveryDays,
          totalQty: 0,
          totalRevenue: 0,
          byDayOfWeek: new Array(7).fill(0),
        });
      }
      
      const item = itemMap.get(key)!;
      const qty = Number(record.quantitySold);
      const revenue = record.grossSalesCents / 100;
      
      item.totalQty += qty;
      item.totalRevenue += revenue;
      
      const dayOfWeek = new Date(record.date).getDay();
      item.byDayOfWeek[dayOfWeek] += qty;
    }
    
    // Build items list with averages
    const weeksInPeriod = Math.max(1, Math.ceil(totalDays / 7));
    const items = Array.from(itemMap.values()).map(item => {
      const avgPerDay = item.totalQty / totalDays;
      const avgPerWeek = item.totalQty / weeksInPeriod;
      const daysUntilDelivery = getDaysUntilDelivery(item.deliveryDays);
      
      // Calculate suggested order: (avgPerDay * daysUntilDelivery) + buffer (20%)
      const buffer = 1.2;
      const suggestedQty = Math.ceil(avgPerDay * daysUntilDelivery * buffer);
      
      return {
        id: `${item.vendor}-${item.itemName}-${item.variationName}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
        itemName: item.itemName,
        variationName: item.variationName,
        displayName: item.variationName ? `${item.itemName} - ${item.variationName}` : item.itemName,
        vendor: item.vendor,
        vendorName: item.vendorName,
        deliveryDays: item.deliveryDays,
        nextDelivery: getNextDeliveryDate(item.deliveryDays),
        daysUntilDelivery,
        totalQty: Math.round(item.totalQty * 10) / 10,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        avgPerWeek: Math.round(avgPerWeek * 10) / 10,
        suggestedQty,
        byDayOfWeek: item.byDayOfWeek.map(qty => Math.round(qty / weeksInPeriod * 10) / 10),
      };
    });
    
    // Sort by total quantity
    items.sort((a, b) => b.totalQty - a.totalQty);
    
    // Group by vendor
    const vendorMap = new Map<string, typeof items>();
    for (const item of items) {
      if (!vendorMap.has(item.vendor)) {
        vendorMap.set(item.vendor, []);
      }
      vendorMap.get(item.vendor)!.push(item);
    }
    
    // Build vendor summaries
    const vendors = Array.from(vendorMap.entries()).map(([vendor, vendorItems]) => {
      const firstItem = vendorItems[0];
      return {
        id: vendor,
        name: firstItem.vendorName,
        deliveryDays: firstItem.deliveryDays,
        nextDelivery: firstItem.nextDelivery,
        daysUntilDelivery: firstItem.daysUntilDelivery,
        itemCount: vendorItems.length,
        totalQty: vendorItems.reduce((sum, i) => sum + i.totalQty, 0),
        totalRevenue: vendorItems.reduce((sum, i) => sum + i.totalRevenue, 0),
        avgPerDay: vendorItems.reduce((sum, i) => sum + i.avgPerDay, 0),
        avgPerWeek: vendorItems.reduce((sum, i) => sum + i.avgPerWeek, 0),
        items: vendorItems,
      };
    });
    
    // Sort vendors by total quantity
    vendors.sort((a, b) => b.totalQty - a.totalQty);
    
    // Calculate summary
    const summary = {
      totalItems: items.length,
      totalQtySold: Math.round(items.reduce((sum, i) => sum + i.totalQty, 0)),
      totalRevenue: Math.round(items.reduce((sum, i) => sum + i.totalRevenue, 0) * 100) / 100,
    };
    
    return createSuccessResponse({
      vendors,
      allItems: items,
      summary,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        weeks: weeksBack,
        days: totalDays,
      },
      meta: { tookMs: Date.now() - startTime },
    });
    
  } catch (error: any) {
    console.error('[Cafe Ordering API] Error:', error);
    return createErrorResponse('CAFE_ORDERING_ERROR', `Failed to fetch cafe ordering data: ${error.message}`, 500);
  }
}

export const dynamic = 'force-dynamic';
