import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const itemWeekdaySchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(itemWeekdaySchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { itemName, startDate, endDate } = validation.data;

    // Build where clause - exact matching first, fallback to contains
    const baseWhere: any = {
      itemName: { equals: itemName }
    };
    
    console.log(`📊 Searching for exact item name: "${itemName}"`);

    if (startDate || endDate) {
      baseWhere.date = {};
      if (startDate) baseWhere.date.gte = new Date(startDate);
      if (endDate) baseWhere.date.lte = new Date(endDate);
    }

    // Check if Square data exists
    const squareDataCount = await prisma.squareDailySales.count({ where: baseWhere });
    const useSquareData = squareDataCount > 0;

    // Get raw sales data for the item
    let salesData: Array<{ date: Date; quantity: number; revenue: number; category: string | null }>;

    if (useSquareData) {
      // Use Square API data
      let squareData = await prisma.squareDailySales.findMany({
        where: baseWhere,
        select: {
          date: true,
          quantitySold: true,
          netSalesCents: true,
          category: true,
        },
        orderBy: { date: 'asc' }
      });

      console.log(`📊 Found ${squareData.length} Square records with exact match for "${itemName}"`);

      // If no exact match, try contains
      if (squareData.length === 0) {
        squareData = await prisma.squareDailySales.findMany({
          where: {
            ...baseWhere,
            itemName: { contains: itemName, mode: 'insensitive' }
          },
          select: {
            date: true,
            quantitySold: true,
            netSalesCents: true,
            category: true,
          },
          orderBy: { date: 'asc' }
        });
        console.log(`📊 Found ${squareData.length} Square records with contains search for "${itemName}"`);
      }

      salesData = squareData.map(r => ({
        date: r.date,
        quantity: Number(r.quantitySold || 0),
        revenue: (r.netSalesCents || 0) / 100,
        category: r.category,
      }));
    } else {
      // Fallback to CSV data
      let legacyData = await prisma.salesAggregate.findMany({
        where: baseWhere,
        select: {
          date: true,
          quantity: true,
          revenue: true,
          category: true,
        },
        orderBy: { date: 'asc' }
      });
      
      console.log(`📊 Found ${legacyData.length} CSV records with exact match for "${itemName}"`);
      
      if (legacyData.length === 0) {
        legacyData = await prisma.salesAggregate.findMany({
          where: {
            ...baseWhere,
            itemName: { contains: itemName, mode: 'insensitive' }
          },
          select: {
            date: true,
            quantity: true,
            revenue: true,
            category: true,
          },
          orderBy: { date: 'asc' }
        });
        console.log(`📊 Found ${legacyData.length} CSV records with contains search for "${itemName}"`);
      }

      salesData = legacyData.map(r => ({
        date: r.date,
        quantity: Number(r.quantity || 0),
        revenue: Number(r.revenue || 0),
        category: r.category,
      }));
    }

    // Group by day of the week (0 = Sunday, 1 = Monday, etc.)
    const weekdayData = Array(7).fill(0).map((_, index) => ({
      dayOfWeek: index,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index],
      quantity: 0,
      revenue: 0,
      count: 0, // Number of days with sales
    }));

    // Aggregate data by day of week
    console.log(`📊 Processing ${salesData.length} records for item: ${itemName}`);
    
    salesData.forEach(record => {
      const dayOfWeek = record.date.getDay();
      // Convert Prisma Decimal to number for arithmetic operations
      const quantity = Number(record.quantity || 0);
      const revenue = Number(record.revenue || 0);
      
      weekdayData[dayOfWeek].quantity += quantity;
      weekdayData[dayOfWeek].revenue += revenue;
      weekdayData[dayOfWeek].count += 1;
      
      if (salesData.length < 10) { // Debug first few records
        console.log(`Record: ${record.date.toISOString().split('T')[0]} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}) - Qty: ${quantity}, Revenue: ${revenue}`);
      }
    });
    
    console.log('📊 Weekday aggregation results:', weekdayData.map(d => ({
      day: d.dayName,
      qty: d.quantity.toFixed(2),
      revenue: d.revenue.toFixed(2),
      count: d.count
    })));

    // Calculate averages per day of week
    // Get unique dates and calculate actual number of weeks covered
    const uniqueDates = new Set(salesData.map(record => record.date.toISOString().split('T')[0]));
    
    // Calculate actual weeks spanned by getting min/max dates and dividing by 7
    let totalWeeks = 1;
    let actualWeeksInPeriod = 1;
    if (salesData.length > 0) {
      const dates = salesData.map(r => r.date.getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const daysDifference = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      totalWeeks = Math.max(1, Math.ceil((daysDifference + 1) / 7));
      
      // Also calculate how many actual weeks are represented in the data period
      actualWeeksInPeriod = Math.max(1, Math.floor(daysDifference / 7) + 1);
    }
    
    const weekdayAverages = weekdayData.map(day => ({
      ...day,
      // Average quantity/revenue per occurrence of this specific weekday
      averageQuantity: day.count > 0 ? day.quantity / day.count : 0,
      averageRevenue: day.count > 0 ? day.revenue / day.count : 0,
      // Average quantity/revenue per week for this weekday (what you'd expect weekly on this day)
      weeklyAverageQuantity: actualWeeksInPeriod > 0 ? day.quantity / actualWeeksInPeriod : 0,
      weeklyAverageRevenue: actualWeeksInPeriod > 0 ? day.revenue / actualWeeksInPeriod : 0,
    }));
    
    console.log(`📊 Total unique dates: ${uniqueDates.size}, Calculated weeks: ${totalWeeks}`);
    if (salesData.length > 0) {
      const dates = salesData.map(r => r.date.toISOString().split('T')[0]);
      const minDate = Math.min(...salesData.map(r => r.date.getTime()));
      const maxDate = Math.max(...salesData.map(r => r.date.getTime()));
      console.log(`📊 Date range: ${new Date(minDate).toISOString().split('T')[0]} to ${new Date(maxDate).toISOString().split('T')[0]}`);
    }

    // Get total stats for the item
    const totals = {
      totalQuantity: salesData.reduce((sum, record) => sum + Number(record.quantity || 0), 0),
      totalRevenue: salesData.reduce((sum, record) => sum + Number(record.revenue || 0), 0),
      totalDays: salesData.length,
      dateRange: {
        start: salesData.length > 0 ? Math.min(...salesData.map(r => r.date.getTime())) : null,
        end: salesData.length > 0 ? Math.max(...salesData.map(r => r.date.getTime())) : null,
      }
    };

    return createSuccessResponse({
      itemName,
      weekdayData: weekdayAverages,
      totals,
    });

  } catch (error) {
    console.error('Item weekday analysis error:', error);
    return createErrorResponse('ANALYSIS_ERROR', 'Failed to analyze item sales by weekday', 500);
  }
}

export const dynamic = 'force-dynamic';