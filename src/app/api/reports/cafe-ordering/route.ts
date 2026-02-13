import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const LOCATION_ID = 'LXREF1GKT3ZMF';

// Vendor patterns - map product names to vendors
const VENDOR_PATTERNS: { vendor: string; patterns: string[] }[] = [
  {
    vendor: 'yomify',
    patterns: ['yomify', 'yogurt', 'açaí', 'acai']
  },
  {
    vendor: 'liz-jackson',
    patterns: ['liz jackson', 'lj ', 'liz j']
  },
  {
    vendor: 'byron-bay-pies',
    patterns: ['byron bay pie', 'bb pie', 'gf pie', 'pie ']
  },
  {
    vendor: 'samosas',
    patterns: ['samosa']
  },
  {
    vendor: 'love-bites',
    patterns: ['love bite', 'love bites', 'bliss ball', 'protein ball', 'energy ball']
  },
  {
    vendor: 'byron-bay-brownies',
    patterns: ['brownie', 'byron brownie', 'bb brownie']
  },
  {
    vendor: 'house-made',
    patterns: ['salad', 'chia cup', 'chia pudding', 'house made', 'house salad']
  }
];

// General cafe patterns for items we haven't mapped yet
const CAFE_PATTERNS = [
  'coffee', 'latte', 'chai', 'cappuccino', 'flat white', 'espresso', 'mocha',
  'smoothie', 'juice', 'kombucha', 'tea', 'muffin', 'cookie', 'cake', 'slice',
  'sandwich', 'wrap', 'toast', 'toastie', 'roll', 'croissant', 'pastry',
  'pie', 'quiche', 'frittata', 'soup', 'bowl', 'salad'
];

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  return new SquareClient({ token: accessToken, environment });
}

function identifyVendor(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();
  
  for (const { vendor, patterns } of VENDOR_PATTERNS) {
    if (patterns.some(pattern => nameLower.includes(pattern))) {
      return vendor;
    }
  }
  
  // Check if it's a general cafe item
  if (CAFE_PATTERNS.some(pattern => nameLower.includes(pattern))) {
    return 'unmapped-cafe';
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeksBack = parseInt(searchParams.get('weeks') || '4');
    
    const client = getSquareClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeksBack * 7));
    
    console.log(`[Cafe Ordering] Fetching sales from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Fetch orders from Square
    const allOrders: any[] = [];
    let cursor: string | undefined;
    
    do {
      const response = await client.orders.searchOrders({
        locationIds: [LOCATION_ID],
        query: {
          filter: {
            dateTimeFilter: {
              closedAt: {
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
              },
            },
            stateFilter: { states: ['COMPLETED'] },
          },
          sort: { sortField: 'CLOSED_AT', sortOrder: 'DESC' },
        },
        cursor,
      });
      
      if (response.result.orders) {
        allOrders.push(...response.result.orders);
      }
      cursor = response.result.cursor;
    } while (cursor);
    
    console.log(`[Cafe Ordering] Found ${allOrders.length} orders`);
    
    // Process orders to extract cafe items
    const itemSales: Map<string, {
      name: string;
      vendor: string;
      totalQty: number;
      totalRevenue: number;
      daysSold: Set<string>;
    }> = new Map();
    
    for (const order of allOrders) {
      if (!order.lineItems) continue;
      
      const orderDate = new Date(order.closedAt).toISOString().split('T')[0];
      
      for (const item of order.lineItems) {
        const itemName = item.name || 'Unknown';
        const vendor = identifyVendor(itemName);
        
        if (!vendor) continue; // Skip non-cafe items
        
        const qty = parseInt(item.quantity) || 1;
        const revenue = item.totalMoney?.amount ? Number(item.totalMoney.amount) / 100 : 0;
        
        const key = `${vendor}::${itemName}`;
        
        if (!itemSales.has(key)) {
          itemSales.set(key, {
            name: itemName,
            vendor,
            totalQty: 0,
            totalRevenue: 0,
            daysSold: new Set(),
          });
        }
        
        const record = itemSales.get(key)!;
        record.totalQty += qty;
        record.totalRevenue += revenue;
        record.daysSold.add(orderDate);
      }
    }
    
    // Calculate averages
    const daysInPeriod = weeksBack * 7;
    const items = Array.from(itemSales.values()).map(item => ({
      name: item.name,
      vendor: item.vendor,
      totalQty: item.totalQty,
      totalRevenue: item.totalRevenue,
      avgPerDay: Math.round((item.totalQty / daysInPeriod) * 10) / 10,
      avgPerWeek: Math.round((item.totalQty / weeksBack) * 10) / 10,
      daysWithSales: item.daysSold.size,
      sellThroughRate: Math.round((item.daysSold.size / daysInPeriod) * 100),
    }));
    
    // Sort by total quantity
    items.sort((a, b) => b.totalQty - a.totalQty);
    
    // Group by vendor
    const byVendor: { [vendor: string]: typeof items } = {};
    for (const item of items) {
      if (!byVendor[item.vendor]) {
        byVendor[item.vendor] = [];
      }
      byVendor[item.vendor].push(item);
    }
    
    // Calculate vendor totals
    const vendorSummaries = Object.entries(byVendor).map(([vendor, vendorItems]) => ({
      vendor,
      itemCount: vendorItems.length,
      totalQty: vendorItems.reduce((sum, i) => sum + i.totalQty, 0),
      totalRevenue: vendorItems.reduce((sum, i) => sum + i.totalRevenue, 0),
      avgPerDay: vendorItems.reduce((sum, i) => sum + i.avgPerDay, 0),
      avgPerWeek: vendorItems.reduce((sum, i) => sum + i.avgPerWeek, 0),
      items: vendorItems,
    }));
    
    vendorSummaries.sort((a, b) => b.totalQty - a.totalQty);
    
    return createSuccessResponse({
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          weeks: weeksBack,
          days: daysInPeriod,
        },
        summary: {
          totalOrders: allOrders.length,
          totalCafeItems: items.length,
          totalQtySold: items.reduce((sum, i) => sum + i.totalQty, 0),
          totalRevenue: items.reduce((sum, i) => sum + i.totalRevenue, 0),
        },
        vendors: vendorSummaries,
        allItems: items,
      },
      meta: { tookMs: Date.now() - startTime }
    });
    
  } catch (error) {
    console.error('[Cafe Ordering] Error:', error);
    return createErrorResponse(error);
  }
}
