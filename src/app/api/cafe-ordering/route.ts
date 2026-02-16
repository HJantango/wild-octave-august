import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Default pack sizes for items sold by piece but ordered as whole units
const DEFAULT_PACK_SIZES: Record<string, { packSize: number; unitName: string }> = {
  'cake': { packSize: 12, unitName: 'cake' },
  'cheesecake': { packSize: 12, unitName: 'cake' },
  'gf chocolate cake': { packSize: 12, unitName: 'cake' },
  'gf carrot cake': { packSize: 12, unitName: 'cake' },
  'gf lemon cake': { packSize: 12, unitName: 'cake' },
};

type PackSizeConfig = Record<string, { packSize: number; unitName: string }>;

// Get pack size config from database or use defaults
async function getPackSizeConfig(): Promise<PackSizeConfig> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'cafe-pack-sizes' },
    });
    if (setting?.value) {
      return setting.value as PackSizeConfig;
    }
  } catch (e) {
    console.warn('Could not load pack sizes, using defaults');
  }
  return DEFAULT_PACK_SIZES;
}

// Find pack size for an item
function getPackSizeForItem(
  itemName: string,
  config: PackSizeConfig
): { packSize: number; unitName: string } | null {
  const nameLower = itemName.toLowerCase();
  
  // Check exact match first
  if (config[nameLower]) {
    return config[nameLower];
  }
  
  // Check partial matches (longer patterns first for specificity)
  const sortedKeys = Object.keys(config).sort((a, b) => b.length - a.length);
  for (const pattern of sortedKeys) {
    if (nameLower.includes(pattern)) {
      return config[pattern];
    }
  }
  
  return null;
}

// Vendor delivery schedules - these could come from a database table
// Map vendor name (lowercase) to delivery days
const VENDOR_DELIVERY_SCHEDULES: Record<string, number[]> = {
  'yummify': [1, 4], // Mon, Thu
  'liz jackson': [2, 5], // Tue, Fri
  'love bites': [2], // Tue
  'byron bay brownies': [3], // Wed
  'marlena': [1], // Mon
  'gigis': [0], // Sun
  // Add more as needed
};

// Categories that indicate cafe items
const CAFE_CATEGORIES = ['cafe', 'bakery', 'sweets', 'treats', 'cakes', 'pastry', 'food'];

// Item name patterns that indicate cafe items (fallback when no category)
const CAFE_ITEM_PATTERNS = [
  'muffin', 'cookie', 'cake', 'slice', 'brownie', 'ball', 'bar',
  'croissant', 'danish', 'scroll', 'bun', 'sweet', 'treat',
  'tart', 'cupcake', 'donut', 'scone', 'friand', 'pie', 'roll',
  'samosa', 'curry puff', 'arancini', 'spring roll'
];

// Check if an item is a cafe item
function isCafeItem(itemName: string, category?: string | null): boolean {
  const nameLower = itemName.toLowerCase();
  
  // Check category first
  if (category && CAFE_CATEGORIES.some(c => category.toLowerCase().includes(c))) {
    return true;
  }
  
  // Check item name patterns
  return CAFE_ITEM_PATTERNS.some(pattern => nameLower.includes(pattern));
}

// Get delivery days for a vendor
function getVendorDeliveryDays(vendorName: string | null): number[] {
  if (!vendorName) return [];
  
  const key = vendorName.toLowerCase();
  
  // Check exact match first
  if (VENDOR_DELIVERY_SCHEDULES[key]) {
    return VENDOR_DELIVERY_SCHEDULES[key];
  }
  
  // Check partial match
  for (const [vendor, days] of Object.entries(VENDOR_DELIVERY_SCHEDULES)) {
    if (key.includes(vendor) || vendor.includes(key)) {
      return days;
    }
  }
  
  return []; // No schedule found
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

// Get the next delivery date string
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
  if (minDays === 7 && deliveryDays.includes(today)) return 'Today';
  return dayNames[nextDay];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeksBack = parseInt(searchParams.get('weeks') || '6');
    
    // Load pack size config
    const packSizeConfig = await getPackSizeConfig();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksBack * 7));
    
    // Fetch all daily sales records with vendor info
    const dailySales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
    
    if (dailySales.length === 0) {
      return createSuccessResponse({
        vendors: [],
        allItems: [],
        summary: { totalItems: 0, totalQtySold: 0, totalRevenue: 0 },
        period: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), weeks: weeksBack, days: 0 },
      });
    }
    
    // Get unique dates and days in period
    const uniqueDates = new Set(dailySales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;
    
    // Aggregate by item and actual vendor from database
    const itemMap = new Map<string, {
      itemName: string;
      variationName: string;
      vendorName: string | null;
      category: string | null;
      totalQty: number;
      totalRevenue: number;
      byDayOfWeek: number[];
    }>();
    
    for (const record of dailySales) {
      // Use the vendorName from the database
      const vendorName = record.vendorName;
      
      // Skip if not a cafe item (unless it has a known cafe vendor)
      const isCafe = isCafeItem(record.itemName, record.category);
      const hasKnownVendor = vendorName && getVendorDeliveryDays(vendorName).length > 0;
      
      if (!isCafe && !hasKnownVendor) continue;
      
      const key = `${vendorName || 'unassigned'}::${record.itemName}::${record.variationName || ''}`;
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemName: record.itemName,
          variationName: record.variationName || '',
          vendorName: vendorName,
          category: record.category,
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
      const deliveryDays = getVendorDeliveryDays(item.vendorName);
      const daysUntilDelivery = getDaysUntilDelivery(deliveryDays);
      
      // Calculate suggested order: (avgPerDay * daysUntilDelivery) + buffer (20%)
      const buffer = 1.2;
      const suggestedQty = Math.ceil(avgPerDay * daysUntilDelivery * buffer);
      
      // Check for pack size (e.g., cake sold by slice but ordered as whole cake)
      const packInfo = getPackSizeForItem(item.itemName, packSizeConfig);
      const hasPackSize = packInfo !== null;
      const packSize = packInfo?.packSize || 1;
      const unitName = packInfo?.unitName || 'unit';
      
      // Calculate order in whole units (round up)
      const suggestedUnits = hasPackSize ? Math.ceil(suggestedQty / packSize) : suggestedQty;
      const totalUnitsFromQty = hasPackSize ? suggestedUnits * packSize : suggestedQty;
      
      return {
        id: `${item.vendorName || 'unassigned'}-${item.itemName}-${item.variationName}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
        itemName: item.itemName,
        variationName: item.variationName,
        displayName: item.variationName ? `${item.itemName} - ${item.variationName}` : item.itemName,
        vendor: (item.vendorName || 'unassigned').toLowerCase().replace(/[^a-z0-9]/g, '-'),
        vendorName: item.vendorName || 'Unassigned Items',
        deliveryDays,
        nextDelivery: getNextDeliveryDate(deliveryDays),
        daysUntilDelivery,
        totalQty: Math.round(item.totalQty * 10) / 10,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        avgPerWeek: Math.round(avgPerWeek * 10) / 10,
        suggestedQty,
        byDayOfWeek: item.byDayOfWeek.map(qty => Math.round(qty / weeksInPeriod * 10) / 10),
        // Pack size info
        hasPackSize,
        packSize,
        unitName,
        suggestedUnits, // How many whole units (cakes/boxes) to order
        totalFromUnits: totalUnitsFromQty, // Total pieces if ordering whole units
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
    
    // Sort vendors: "unassigned" at bottom, then by urgency (days until delivery), then by total quantity
    vendors.sort((a, b) => {
      // "Unassigned" always last
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      // Vendors with delivery schedules before those without
      if (a.deliveryDays.length > 0 && b.deliveryDays.length === 0) return -1;
      if (a.deliveryDays.length === 0 && b.deliveryDays.length > 0) return 1;
      // Sort by days until delivery (most urgent first)
      if (a.daysUntilDelivery !== b.daysUntilDelivery) {
        return a.daysUntilDelivery - b.daysUntilDelivery;
      }
      // Then by total quantity
      return b.totalQty - a.totalQty;
    });
    
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
