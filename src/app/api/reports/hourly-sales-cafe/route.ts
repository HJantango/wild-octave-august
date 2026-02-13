import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const LOCATION_ID = 'LXREF1GKT3ZMF';

// Define cafe item patterns - these will match item names
const CAFE_DRINK_PATTERNS = [
  'coffee', 'latte', 'chai', 'cappuccino', 'flat white', 'long black',
  'espresso', 'mocha', 'hot chocolate', 'turmeric latte', 'matcha',
  'smoothie', 'juice', 'kombucha', 'tea', 'iced coffee', 'frappe',
  'milkshake', 'shake', 'tonic', 'soda', 'water bottle',
];

const CAFE_FOOD_PATTERNS = [
  'pie', 'pies', 'gf pie', 'cake', 'slice', 'muffin', 'cookie', 'brownie',
  'salad', 'sandwich', 'wrap', 'toast', 'toastie', 'roll', 'burger',
  'bowl', 'soup', 'quiche', 'frittata', 'eggs', 'breakfast',
  'lunch special', 'daily special', 'meal', 'snack',
  'bliss ball', 'protein ball', 'energy ball', 'raw treat',
  'croissant', 'pastry', 'danish', 'scroll', 'bun',
];

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

function isCafeItem(itemName: string, type?: 'food' | 'drink' | 'all'): { isCafe: boolean; category: 'food' | 'drink' | null } {
  const nameLower = itemName.toLowerCase();
  
  // Check drinks first
  const isDrink = CAFE_DRINK_PATTERNS.some(pattern => nameLower.includes(pattern));
  if (isDrink && (type === 'drink' || type === 'all' || !type)) {
    return { isCafe: true, category: 'drink' };
  }
  
  // Check food
  const isFood = CAFE_FOOD_PATTERNS.some(pattern => nameLower.includes(pattern));
  if (isFood && (type === 'food' || type === 'all' || !type)) {
    return { isCafe: true, category: 'food' };
  }
  
  return { isCafe: false, category: null };
}

interface HourlyData {
  hour: number;
  dayOfWeek: number;
  totalCents: number;
  orderCount: number;
  itemCount: number;
  foodCents: number;
  drinkCents: number;
  foodItems: number;
  drinkItems: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeksBack = parseInt(searchParams.get('weeks') || '12');
    const filterType = searchParams.get('type') as 'food' | 'drink' | 'all' || 'all';
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);

    console.log(`📊 Fetching cafe hourly sales from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    let client;
    try {
      client = getSquareClient();
    } catch (err: any) {
      console.error('❌ Square client error:', err.message);
      return createErrorResponse('SQUARE_CLIENT_ERROR', err.message, 500);
    }
    
    console.log(`⏱️ Square client created in ${Date.now() - startTime}ms`);
    
    // Fetch all completed orders
    const allOrders: any[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 50;

    do {
      pageCount++;
      const requestBody: any = {
        locationIds: [LOCATION_ID],
        query: {
          filter: {
            stateFilter: { states: ['COMPLETED'] },
            dateTimeFilter: {
              createdAt: {
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
              },
            },
          },
          sort: { sortField: 'CREATED_AT', sortOrder: 'DESC' },
        },
        limit: 500,
        ...(cursor && { cursor }),
      };

      const response: any = await client.orders.search(requestBody);
      const orders = response.result?.orders || response.orders || [];
      allOrders.push(...orders);
      cursor = response.result?.cursor || response.cursor || undefined;
    } while (cursor && pageCount < MAX_PAGES);

    console.log(`📦 Fetched ${allOrders.length} orders in ${Date.now() - startTime}ms`);

    // Aggregate cafe items by hour and day of week
    const hourlyMap = new Map<string, HourlyData>();
    const dayCountMap = new Map<number, Set<string>>();
    
    let totalCafeItems = 0;
    let totalCafeRevenue = 0;
    let totalFoodRevenue = 0;
    let totalDrinkRevenue = 0;
    const topCafeItems = new Map<string, { count: number; revenue: number; category: string }>();

    for (const order of allOrders) {
      if (!order.lineItems) continue;

      const createdAt = new Date(order.createdAt);
      const sydneyTime = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
      const hour = sydneyTime.getHours();
      const dayOfWeek = sydneyTime.getDay();
      const dateStr = sydneyTime.toISOString().split('T')[0];

      // Track unique dates per day of week
      if (!dayCountMap.has(dayOfWeek)) {
        dayCountMap.set(dayOfWeek, new Set());
      }
      dayCountMap.get(dayOfWeek)!.add(dateStr);

      for (const item of order.lineItems) {
        const itemName = item.name || 'Unknown';
        const cafeCheck = isCafeItem(itemName, filterType);
        
        if (!cafeCheck.isCafe) continue;

        const key = `${hour}-${dayOfWeek}`;
        const quantity = parseFloat(item.quantity || '0');
        const itemCents = Number(item.totalMoney?.amount || 0);

        totalCafeItems++;
        totalCafeRevenue += itemCents;
        
        if (cafeCheck.category === 'food') {
          totalFoodRevenue += itemCents;
        } else {
          totalDrinkRevenue += itemCents;
        }

        // Track top items
        if (topCafeItems.has(itemName)) {
          const existing = topCafeItems.get(itemName)!;
          existing.count += quantity;
          existing.revenue += itemCents;
        } else {
          topCafeItems.set(itemName, { count: quantity, revenue: itemCents, category: cafeCheck.category || 'unknown' });
        }

        if (hourlyMap.has(key)) {
          const existing = hourlyMap.get(key)!;
          existing.totalCents += itemCents;
          existing.orderCount += 1;
          existing.itemCount += quantity;
          if (cafeCheck.category === 'food') {
            existing.foodCents += itemCents;
            existing.foodItems += quantity;
          } else {
            existing.drinkCents += itemCents;
            existing.drinkItems += quantity;
          }
        } else {
          hourlyMap.set(key, {
            hour,
            dayOfWeek,
            totalCents: itemCents,
            orderCount: 1,
            itemCount: quantity,
            foodCents: cafeCheck.category === 'food' ? itemCents : 0,
            drinkCents: cafeCheck.category === 'drink' ? itemCents : 0,
            foodItems: cafeCheck.category === 'food' ? quantity : 0,
            drinkItems: cafeCheck.category === 'drink' ? quantity : 0,
          });
        }
      }
    }

    console.log(`☕ Found ${totalCafeItems} cafe items, ${formatDollars(totalCafeRevenue)} revenue`);

    // Calculate averages per hour per day
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hourlyAverages: any[] = [];

    for (let hour = 6; hour <= 19; hour++) {
      const hourData: any = {
        hour,
        hourLabel: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`,
        days: {},
        overallAvg: 0,
        foodAvg: 0,
        drinkAvg: 0,
        totalRevenue: 0,
      };

      let totalForHour = 0;
      let foodForHour = 0;
      let drinkForHour = 0;
      let daysWithData = 0;

      for (let dow = 0; dow <= 6; dow++) {
        const key = `${hour}-${dow}`;
        const data = hourlyMap.get(key);
        const uniqueDays = dayCountMap.get(dow)?.size || 1;

        if (data) {
          const avgRevenue = data.totalCents / 100 / uniqueDays;
          const avgFood = data.foodCents / 100 / uniqueDays;
          const avgDrink = data.drinkCents / 100 / uniqueDays;
          const avgItems = data.itemCount / uniqueDays;
          
          hourData.days[dayNames[dow]] = {
            avgRevenue: Math.round(avgRevenue * 100) / 100,
            avgFood: Math.round(avgFood * 100) / 100,
            avgDrink: Math.round(avgDrink * 100) / 100,
            avgItems: Math.round(avgItems * 10) / 10,
            totalRevenue: data.totalCents / 100,
          };
          totalForHour += avgRevenue;
          foodForHour += avgFood;
          drinkForHour += avgDrink;
          daysWithData++;
          hourData.totalRevenue += data.totalCents / 100;
        } else {
          hourData.days[dayNames[dow]] = {
            avgRevenue: 0,
            avgFood: 0,
            avgDrink: 0,
            avgItems: 0,
            totalRevenue: 0,
          };
        }
      }

      hourData.overallAvg = daysWithData > 0 ? Math.round(totalForHour / daysWithData * 100) / 100 : 0;
      hourData.foodAvg = daysWithData > 0 ? Math.round(foodForHour / daysWithData * 100) / 100 : 0;
      hourData.drinkAvg = daysWithData > 0 ? Math.round(drinkForHour / daysWithData * 100) / 100 : 0;
      hourlyAverages.push(hourData);
    }

    // Calculate peak hours
    const sortedByRevenue = [...hourlyAverages].sort((a, b) => b.overallAvg - a.overallAvg);
    const peakHours = sortedByRevenue.slice(0, 3).map(h => h.hourLabel);
    const quietHours = sortedByRevenue.slice(-3).filter(h => h.overallAvg > 0).map(h => h.hourLabel);

    // Top cafe items
    const topItems = [...topCafeItems.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 15)
      .map(([name, data]) => ({
        name,
        count: Math.round(data.count),
        revenue: data.revenue / 100,
        category: data.category,
      }));

    // Daily summary
    const dailySummary: any = {};
    for (let dow = 0; dow <= 6; dow++) {
      const dayTotal = hourlyAverages.reduce((sum, h) => sum + (h.days[dayNames[dow]]?.avgRevenue || 0), 0);
      const foodTotal = hourlyAverages.reduce((sum, h) => sum + (h.days[dayNames[dow]]?.avgFood || 0), 0);
      const drinkTotal = hourlyAverages.reduce((sum, h) => sum + (h.days[dayNames[dow]]?.avgDrink || 0), 0);
      dailySummary[dayNames[dow]] = {
        avgDailyRevenue: Math.round(dayTotal * 100) / 100,
        avgFood: Math.round(foodTotal * 100) / 100,
        avgDrink: Math.round(drinkTotal * 100) / 100,
        uniqueDays: dayCountMap.get(dow)?.size || 0,
      };
    }

    return createSuccessResponse({
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        weeks: weeksBack,
      },
      filterType,
      summary: {
        totalCafeItems,
        totalCafeRevenue: totalCafeRevenue / 100,
        totalFoodRevenue: totalFoodRevenue / 100,
        totalDrinkRevenue: totalDrinkRevenue / 100,
        foodPercent: totalCafeRevenue > 0 ? Math.round(totalFoodRevenue / totalCafeRevenue * 100) : 0,
        drinkPercent: totalCafeRevenue > 0 ? Math.round(totalDrinkRevenue / totalCafeRevenue * 100) : 0,
      },
      hourlyData: hourlyAverages,
      dailySummary,
      topItems,
      insights: {
        peakHours,
        quietHours,
        busiestDay: Object.entries(dailySummary)
          .sort((a: any, b: any) => b[1].avgDailyRevenue - a[1].avgDailyRevenue)[0]?.[0],
        quietestDay: Object.entries(dailySummary)
          .filter((e: any) => e[1].avgDailyRevenue > 0)
          .sort((a: any, b: any) => a[1].avgDailyRevenue - b[1].avgDailyRevenue)[0]?.[0],
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Cafe hourly sales error after ${elapsed}ms:`, error);
    const errorMessage = error?.message || String(error);
    const errorDetail = error?.errors ? JSON.stringify(error.errors) : errorMessage;
    return createErrorResponse('CAFE_HOURLY_SALES_ERROR', `${errorMessage} (after ${elapsed}ms)`, 500);
  }
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
