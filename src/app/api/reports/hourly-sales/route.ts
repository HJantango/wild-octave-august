import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const LOCATION_ID = 'LXREF1GKT3ZMF';

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

interface HourlyData {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  totalCents: number;
  orderCount: number;
  itemCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeksBack = parseInt(searchParams.get('weeks') || '12'); // Default 12 weeks (3 months)
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);

    console.log(`📊 Fetching hourly sales from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const client = getSquareClient();
    
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

    console.log(`📦 Fetched ${allOrders.length} orders`);

    // Aggregate by hour and day of week
    // Using Australia/Sydney timezone
    const hourlyMap = new Map<string, HourlyData>();
    const dayCountMap = new Map<number, Set<string>>(); // Track unique dates per day of week

    for (const order of allOrders) {
      const createdAt = new Date(order.createdAt);
      // Convert to Sydney timezone
      const sydneyTime = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
      const hour = sydneyTime.getHours();
      const dayOfWeek = sydneyTime.getDay();
      const dateStr = sydneyTime.toISOString().split('T')[0];

      const key = `${hour}-${dayOfWeek}`;
      
      // Track unique dates for averaging
      if (!dayCountMap.has(dayOfWeek)) {
        dayCountMap.set(dayOfWeek, new Set());
      }
      dayCountMap.get(dayOfWeek)!.add(dateStr);

      const totalCents = Number(order.totalMoney?.amount || 0);
      const itemCount = order.lineItems?.reduce((sum: number, item: any) => 
        sum + parseFloat(item.quantity || '0'), 0) || 0;

      if (hourlyMap.has(key)) {
        const existing = hourlyMap.get(key)!;
        existing.totalCents += totalCents;
        existing.orderCount += 1;
        existing.itemCount += itemCount;
      } else {
        hourlyMap.set(key, {
          hour,
          dayOfWeek,
          totalCents,
          orderCount: 1,
          itemCount,
        });
      }
    }

    // Calculate averages per hour per day
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hourlyAverages: any[] = [];

    // Create data structure for each hour (6am to 7pm typically for health food shop)
    for (let hour = 6; hour <= 19; hour++) {
      const hourData: any = {
        hour,
        hourLabel: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`,
        days: {},
        overallAvg: 0,
        overallOrders: 0,
        overallItems: 0,
        totalRevenue: 0,
      };

      let totalForHour = 0;
      let daysWithData = 0;

      for (let dow = 0; dow <= 6; dow++) {
        const key = `${hour}-${dow}`;
        const data = hourlyMap.get(key);
        const uniqueDays = dayCountMap.get(dow)?.size || 1;

        if (data) {
          const avgRevenue = data.totalCents / 100 / uniqueDays;
          const avgOrders = data.orderCount / uniqueDays;
          const avgItems = data.itemCount / uniqueDays;
          
          hourData.days[dayNames[dow]] = {
            avgRevenue: Math.round(avgRevenue * 100) / 100,
            avgOrders: Math.round(avgOrders * 10) / 10,
            avgItems: Math.round(avgItems * 10) / 10,
            totalRevenue: data.totalCents / 100,
            totalOrders: data.orderCount,
          };
          totalForHour += avgRevenue;
          daysWithData++;
          hourData.totalRevenue += data.totalCents / 100;
          hourData.overallOrders += data.orderCount;
          hourData.overallItems += data.itemCount;
        } else {
          hourData.days[dayNames[dow]] = {
            avgRevenue: 0,
            avgOrders: 0,
            avgItems: 0,
            totalRevenue: 0,
            totalOrders: 0,
          };
        }
      }

      hourData.overallAvg = daysWithData > 0 ? Math.round(totalForHour / daysWithData * 100) / 100 : 0;
      hourlyAverages.push(hourData);
    }

    // Calculate peak hours
    const sortedByRevenue = [...hourlyAverages].sort((a, b) => b.overallAvg - a.overallAvg);
    const peakHours = sortedByRevenue.slice(0, 3).map(h => h.hourLabel);
    const quietHours = sortedByRevenue.slice(-3).filter(h => h.overallAvg > 0).map(h => h.hourLabel);

    // Daily summary
    const dailySummary: any = {};
    for (let dow = 0; dow <= 6; dow++) {
      const dayTotal = hourlyAverages.reduce((sum, h) => sum + (h.days[dayNames[dow]]?.avgRevenue || 0), 0);
      dailySummary[dayNames[dow]] = {
        avgDailyRevenue: Math.round(dayTotal * 100) / 100,
        uniqueDays: dayCountMap.get(dow)?.size || 0,
      };
    }

    return createSuccessResponse({
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
        weeks: weeksBack,
      },
      totalOrders: allOrders.length,
      hourlyData: hourlyAverages,
      dailySummary,
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
    console.error('❌ Hourly sales error:', error);
    return createErrorResponse('HOURLY_SALES_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
