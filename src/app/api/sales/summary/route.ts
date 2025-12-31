import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { salesFilterSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(salesFilterSchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { category, itemName, startDate, endDate } = validation.data;

    // Build where clause for date filtering
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    // Get overall summary
    const [
      categoryAggregates,
      itemAggregates,
      totalRevenue,
      totalQuantity,
      reportCount,
      dateRange
    ] = await Promise.all([
      // Category totals
      prisma.salesAggregate.groupBy({
        by: ['category'],
        where: {
          ...where,
          category: { not: null },
          ...(category && { category }),
        },
        _sum: {
          revenue: true,
          quantity: true,
        },
        orderBy: {
          _sum: { revenue: 'desc' },
        },
        take: 10,
      }),

      // Item totals - group by individual variations (itemName)
      prisma.salesAggregate.groupBy({
        by: ['itemName'],
        where: {
          ...where,
          itemName: { not: null },
          ...(itemName && { itemName: { contains: itemName, mode: 'insensitive' } }),
        },
        _sum: {
          revenue: true,
          quantity: true,
        },
        orderBy: {
          _sum: { revenue: 'desc' },
        },
        take: 25, // Increase to show more variations after filtering
      }),

      // Total revenue
      prisma.salesAggregate.aggregate({
        where,
        _sum: { revenue: true },
      }),

      // Total quantity
      prisma.salesAggregate.aggregate({
        where,
        _sum: { quantity: true },
      }),

      // Report count
      prisma.salesReport.count(),

      // Date range
      prisma.salesAggregate.aggregate({
        where,
        _min: { date: true },
        _max: { date: true },
      }),
    ]);

    // Format category results
    const topCategories = categoryAggregates.map(agg => ({
      category: agg.category,
      revenue: agg._sum.revenue || 0,
      quantity: agg._sum.quantity || 0,
      percentage: totalRevenue._sum.revenue 
        ? ((agg._sum.revenue || 0) / totalRevenue._sum.revenue) * 100 
        : 0,
    }));

    // Filter out generic parent items to show only specific variations
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
    
    // Debug logging to see item names before filtering
    console.log('🔍 All items before filtering:', itemAggregates.slice(0, 10).map(agg => agg.itemName));
    
    // Filter out generic parent items
    const filteredItemAggregates = itemAggregates.filter(agg => 
      !genericItems.includes(agg.itemName) && 
      agg.itemName && 
      agg.itemName.length > 3 // Exclude very short generic names
    );
    
    console.log('🔍 Items after filtering generics:', filteredItemAggregates.slice(0, 10).map(agg => agg.itemName));
    
    // Format item results using filtered data
    const topItems = filteredItemAggregates.map(agg => ({
      itemName: agg.itemName,
      revenue: agg._sum.revenue || 0,
      quantity: agg._sum.quantity || 0,
      percentage: totalRevenue._sum.revenue 
        ? ((agg._sum.revenue || 0) / totalRevenue._sum.revenue) * 100 
        : 0,
    }));


    const summary = {
      overview: {
        totalRevenue: totalRevenue._sum.revenue || 0,
        totalQuantity: totalQuantity._sum.quantity || 0,
        reportCount,
        dateRange: {
          start: dateRange._min.date,
          end: dateRange._max.date,
        },
      },
      topCategories,
      topItems,
    };

    return createSuccessResponse(summary);

  } catch (error) {
    console.error('Sales summary error:', error);
    return createErrorResponse('SUMMARY_ERROR', 'Failed to generate sales summary', 500);
  }
}

export const dynamic = 'force-dynamic';