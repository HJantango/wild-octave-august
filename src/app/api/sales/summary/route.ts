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

    // Use SquareDailySales (from Square API sync) as primary data source
    // Falls back to SalesAggregate if no Square data exists
    const squareDataCount = await prisma.squareDailySales.count({ where });
    const useSquareData = squareDataCount > 0;

    if (useSquareData) {
      // Use Square API synced data
      const [
        categoryAggregates,
        itemAggregates,
        totals,
        dateRange
      ] = await Promise.all([
        // Category totals (filter nulls in JS to avoid Prisma quirks)
        prisma.squareDailySales.groupBy({
          by: ['category'],
          where,
          _sum: {
            netSalesCents: true,
            quantitySold: true,
          },
        }),

        // Item totals (filter nulls in JS to avoid Prisma quirks)
        prisma.squareDailySales.groupBy({
          by: ['itemName'],
          where,
          _sum: {
            netSalesCents: true,
            quantitySold: true,
          },
        }),

        // Totals
        prisma.squareDailySales.aggregate({
          where,
          _sum: { netSalesCents: true, quantitySold: true },
        }),

        // Date range
        prisma.squareDailySales.aggregate({
          where,
          _min: { date: true },
          _max: { date: true },
        }),
      ]);

      const totalRevenueCents = totals._sum.netSalesCents || 0;
      const totalRevenueValue = totalRevenueCents / 100; // Convert cents to dollars

      // Format and sort category results (filter out null categories)
      const topCategories = categoryAggregates
        .filter(agg => agg.category != null)
        .map(agg => ({
          category: agg.category,
          revenue: (agg._sum.netSalesCents || 0) / 100,
          quantity: Number(agg._sum.quantitySold) || 0,
          percentage: totalRevenueCents > 0 
            ? ((agg._sum.netSalesCents || 0) / totalRevenueCents) * 100 
            : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Format item results (filter generic items and nulls, sort by revenue)
      const genericItems = ['Pies', 'Pie', 'Cake', 'Coffee', 'Smoothie', 'Salad'];
      const topItems = itemAggregates
        .filter(agg => agg.itemName != null && !genericItems.includes(agg.itemName) && agg.itemName.length > 3)
        .map(agg => ({
          itemName: agg.itemName,
          revenue: (agg._sum.netSalesCents || 0) / 100,
          quantity: Number(agg._sum.quantitySold) || 0,
          percentage: totalRevenueCents > 0 
            ? ((agg._sum.netSalesCents || 0) / totalRevenueCents) * 100 
            : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 25);

      return createSuccessResponse({
        overview: {
          totalRevenue: totalRevenueValue,
          totalQuantity: Number(totals._sum.quantitySold) || 0,
          reportCount: squareDataCount,
          dateRange: {
            start: dateRange._min.date,
            end: dateRange._max.date,
          },
        },
        topCategories,
        topItems,
        dataSource: 'square_api',
      });
    }

    // Fallback to CSV-uploaded SalesAggregate data
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
      dataSource: 'csv_upload',
    };

    return createSuccessResponse(summary);

  } catch (error) {
    console.error('Sales summary error:', error);
    return createErrorResponse('SUMMARY_ERROR', 'Failed to generate sales summary', 500);
  }
}

export const dynamic = 'force-dynamic';