import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const timePeriodAnalysisSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').default('08:00'),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').default('17:00'),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  analysisType: z.enum(['category', 'item']).default('category'),
  filterBy: z.string().optional(), // Filter by specific item or category name
  limit: z.number().min(1).max(50).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    // Convert string values to appropriate types
    const processedParams = {
      ...searchParams,
      limit: searchParams.limit ? parseInt(searchParams.limit) : undefined,
    };

    const validation = validateRequest(timePeriodAnalysisSchema, processedParams);

    if (!validation.success) {
      return validation.error;
    }

    const { 
      startDate, 
      endDate, 
      timeStart,
      timeEnd,
      groupBy,
      analysisType,
      filterBy,
      limit
    } = validation.data;

    console.log(`⏰ Time period analysis: ${timeStart}-${timeEnd}, grouped by ${groupBy}, type: ${analysisType}${filterBy ? `, filter: ${filterBy}` : ''}`);

    // Build date filter - default to last 8 weeks if no dates specified
    const where: any = {};
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    } else {
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - (8 * 7));
      where.date = { gte: eightWeeksAgo };
    }

    // Exclude Shelf Labels from analysis
    where.category = { not: 'Shelf Labels' };

    // Add specific item or category filter if provided
    if (filterBy) {
      if (analysisType === 'category') {
        where.category = { 
          AND: [
            { not: 'Shelf Labels' },
            { equals: filterBy }
          ]
        };
      } else {
        where.itemName = { equals: filterBy };
      }
    }

    // Since we don't have actual time data in sales_aggregates, we'll simulate it
    // In a real implementation, this would filter by actual time data
    // For now, we'll apply a time-based distribution simulation

    const salesData = await prisma.salesAggregate.findMany({
      where,
      select: {
        date: true,
        category: true,
        itemName: true,
        quantity: true,
        revenue: true,
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`⏰ Found ${salesData.length} records for time period analysis`);

    if (salesData.length === 0) {
      return createSuccessResponse({
        timeFilter: { start: timeStart, end: timeEnd },
        analysisType,
        groupBy,
        summary: {
          totalRecords: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          periodsAnalyzed: 0,
        },
        data: [],
        topPerformers: [],
      });
    }

    // Simulate time-based filtering by applying a distribution model
    // This assumes different times of day have different sales patterns
    const timeFilteredData = applySimulatedTimeFilter(salesData, timeStart, timeEnd);

    console.log(`⏰ After time filtering (${timeStart}-${timeEnd}): ${timeFilteredData.length} records`);

    // Group data by the specified period
    const groupedData = groupDataByPeriod(timeFilteredData, groupBy);

    // Aggregate by analysis type (category or item)
    const aggregatedData = aggregateByType(groupedData, analysisType, limit);

    // Calculate summary statistics
    const summary = calculateSummary(timeFilteredData, groupedData);

    // Get top performers for the entire period
    const topPerformers = getTopPerformers(timeFilteredData, analysisType, 5);

    return createSuccessResponse({
      timeFilter: { start: timeStart, end: timeEnd },
      analysisType,
      groupBy,
      dateRange: {
        start: salesData.length > 0 ? Math.min(...salesData.map(r => r.date.getTime())) : null,
        end: salesData.length > 0 ? Math.max(...salesData.map(r => r.date.getTime())) : null,
      },
      summary,
      data: aggregatedData,
      topPerformers,
    });

  } catch (error) {
    console.error('Time period analysis error:', error);
    return createErrorResponse('ANALYSIS_ERROR', 'Failed to analyze sales by time period', 500);
  }
}

function applySimulatedTimeFilter(salesData: any[], timeStart: string, timeEnd: string) {
  // Parse time strings
  const [startHour, startMin] = timeStart.split(':').map(Number);
  const [endHour, endMin] = timeEnd.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Business hours typically: 8am-5pm (9 hours)
  // Time period as fraction of business day
  const businessDayMinutes = 9 * 60; // 9 hours
  const filterMinutes = endMinutes - startMinutes;
  const timeFraction = Math.min(filterMinutes / businessDayMinutes, 1.0);
  
  console.log(`⏰ Time filter: ${timeStart}-${timeEnd} = ${filterMinutes} minutes (${(timeFraction * 100).toFixed(1)}% of business day)`);

  // Apply time-based distribution simulation
  return salesData.map(record => {
    // Simulate that different times have different sales patterns
    // Morning (8-12): 35% of daily sales
    // Afternoon (12-17): 65% of daily sales
    let adjustmentFactor = timeFraction;
    
    // If filtering for morning hours (before 12:00)
    if (endMinutes <= 12 * 60) {
      adjustmentFactor = timeFraction * 0.35;
    }
    // If filtering for afternoon hours (after 12:00)
    else if (startMinutes >= 12 * 60) {
      adjustmentFactor = timeFraction * 0.65;
    }
    // If spanning lunch time, use full business day distribution
    else {
      adjustmentFactor = timeFraction;
    }

    return {
      ...record,
      quantity: Number(record.quantity) * adjustmentFactor,
      revenue: Number(record.revenue) * adjustmentFactor,
      originalQuantity: Number(record.quantity),
      originalRevenue: Number(record.revenue),
      timeAdjustment: adjustmentFactor,
    };
  });
}

function groupDataByPeriod(salesData: any[], groupBy: string) {
  const grouped: Record<string, any[]> = {};

  salesData.forEach(record => {
    let periodKey: string;
    const date = new Date(record.date);

    switch (groupBy) {
      case 'daily':
        periodKey = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        // Get Monday of the week
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        periodKey = `Week of ${weekStart.toISOString().split('T')[0]}`;
        break;
      case 'monthly':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        periodKey = date.toISOString().split('T')[0];
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = [];
    }

    grouped[periodKey].push(record);
  });

  return grouped;
}

function aggregateByType(groupedData: Record<string, any[]>, analysisType: string, limit: number) {
  const periods = Object.keys(groupedData).sort();
  
  return periods.map(period => {
    const periodData = groupedData[period];
    const aggregated: Record<string, { quantity: number; revenue: number; count: number }> = {};

    // Aggregate by category or item
    periodData.forEach(record => {
      const key = analysisType === 'category' ? record.category : record.itemName;
      if (!key) return;

      if (!aggregated[key]) {
        aggregated[key] = { quantity: 0, revenue: 0, count: 0 };
      }

      aggregated[key].quantity += record.quantity;
      aggregated[key].revenue += record.revenue;
      aggregated[key].count += 1;
    });

    // Filter out generic parent items if analyzing by item
    const genericItems = [
      // Food categories
      'Pies', 'Pie', 'pies', 'pie', 'Gf pie', 'GF pie', 'GF pies',
      'Cake', 'cake', 'Cakes', 'cakes',
      'Coffee', 'coffee', 'Chai Latte', 'Turmeric Latte',
      'Hot Chocolate', 'Chocolate',
      
      // Loco Love variants
      'Loco Love', 'loco love', 'Naked Loco Love',
      
      // Other snacks/treats
      'Bliss Ball', 'Yumbar', 'yumbar',
      
      // Drinks that have specific flavored variants
      'Smoothie', 'smoothie', 'Juice', 'juice', 'Latte', 'latte',
      
      // Single ingredient items that have specific variants
      'Broccoli', 'Celery', 'Ginger', 'Zucchini', 'Tomatoes',
      'Beetroot', 'Coriander', 'English Spinach', 'Corn',
      'Watermelon', 'Turmeric', 'Mint', 'Chilli',
      
      // Salads that might have size variants
      'Salad', 'salad'
    ];
    
    // Convert to array and sort by revenue
    const items = Object.entries(aggregated)
      .filter(([name]) => {
        if (analysisType === 'item') {
          return !genericItems.includes(name) && name.length > 3;
        }
        return true; // Don't filter categories
      })
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
        count: data.count,
        averagePerOccurrence: data.count > 0 ? data.revenue / data.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return {
      period,
      items,
      totalRevenue: items.reduce((sum, item) => sum + item.revenue, 0),
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      itemCount: items.length,
    };
  });
}

function calculateSummary(timeFilteredData: any[], groupedData: Record<string, any[]>) {
  const totalRecords = timeFilteredData.length;
  const totalRevenue = timeFilteredData.reduce((sum, record) => sum + record.revenue, 0);
  const totalQuantity = timeFilteredData.reduce((sum, record) => sum + record.quantity, 0);
  const periodsAnalyzed = Object.keys(groupedData).length;
  const averageRevenuePerPeriod = periodsAnalyzed > 0 ? totalRevenue / periodsAnalyzed : 0;

  return {
    totalRecords,
    totalRevenue,
    totalQuantity,
    periodsAnalyzed,
    averageRevenuePerPeriod,
  };
}

function getTopPerformers(timeFilteredData: any[], analysisType: string, limit: number) {
  const aggregated: Record<string, { quantity: number; revenue: number; count: number }> = {};

  timeFilteredData.forEach(record => {
    const key = analysisType === 'category' ? record.category : record.itemName;
    if (!key) return;

    if (!aggregated[key]) {
      aggregated[key] = { quantity: 0, revenue: 0, count: 0 };
    }

    aggregated[key].quantity += record.quantity;
    aggregated[key].revenue += record.revenue;
    aggregated[key].count += 1;
  });

  // Filter out generic parent items if analyzing by item
  const genericItems = [
    // Food categories
    'Pies', 'Pie', 'pies', 'pie', 'Gf pie', 'GF pie', 'GF pies',
    'Cake', 'cake', 'Cakes', 'cakes',
    'Coffee', 'coffee', 'Chai Latte', 'Turmeric Latte',
    'Hot Chocolate', 'Chocolate',
    
    // Loco Love variants
    'Loco Love', 'loco love', 'Naked Loco Love',
    
    // Other snacks/treats
    'Bliss Ball', 'Yumbar', 'yumbar',
    
    // Drinks that have specific flavored variants
    'Smoothie', 'smoothie', 'Juice', 'juice', 'Latte', 'latte',
    
    // Single ingredient items that have specific variants
    'Broccoli', 'Celery', 'Ginger', 'Zucchini', 'Tomatoes',
    'Beetroot', 'Coriander', 'English Spinach', 'Corn',
    'Watermelon', 'Turmeric', 'Mint', 'Chilli',
    
    // Salads that might have size variants
    'Salad', 'salad'
  ];
  
  return Object.entries(aggregated)
    .filter(([name]) => {
      if (analysisType === 'item') {
        return !genericItems.includes(name) && name.length > 3;
      }
      return true; // Don't filter categories
    })
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: data.revenue,
      count: data.count,
      averagePerOccurrence: data.count > 0 ? data.revenue / data.count : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export const dynamic = 'force-dynamic';