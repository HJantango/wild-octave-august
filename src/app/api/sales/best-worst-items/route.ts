import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const bestWorstItemsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['revenue', 'quantity']).default('revenue'),
  limit: z.number().min(50).max(200).default(100),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    // Convert string values to appropriate types
    const processedParams = {
      ...searchParams,
      limit: searchParams.limit ? parseInt(searchParams.limit) : undefined,
    };

    const validation = validateRequest(bestWorstItemsSchema, processedParams);

    if (!validation.success) {
      return validation.error;
    }

    const { startDate, endDate, sortBy, limit } = validation.data;

    console.log(`📊 Best/Worst items analysis: sortBy=${sortBy}, limit=${limit}`);

    // Build date filter - default to last 3 months if no dates specified
    const where: any = {
      // Only exclude null items - let all categories through initially
      itemName: { not: null }
    };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    } else {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      where.date = { gte: threeMonthsAgo };
    }

    // Check if Square data exists
    const squareDataCount = await prisma.squareDailySales.count({ where });
    const useSquareData = squareDataCount > 0;

    let itemsData: any[];

    if (useSquareData) {
      // Use Square API data
      const squareItems = await prisma.squareDailySales.groupBy({
        by: ['itemName'],
        where,
        _sum: {
          quantitySold: true,
          netSalesCents: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: sortBy === 'revenue' ? { netSalesCents: 'desc' } : { quantitySold: 'desc' }
        },
        take: limit,
      });
      
      // Convert to standard format
      itemsData = squareItems.map(item => ({
        itemName: item.itemName,
        _sum: {
          quantity: item._sum.quantitySold,
          revenue: (item._sum.netSalesCents || 0) / 100, // Convert cents to dollars
        },
        _count: { _all: item._count._all },
      }));
    } else {
      // Fallback to CSV data
      itemsData = await prisma.salesAggregate.groupBy({
        by: ['itemName'],
        where,
        _sum: {
          quantity: true,
          revenue: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: {
            [sortBy]: 'desc'
          }
        },
        take: limit,
      });
    }

    console.log(`📊 Found ${itemsData.length} items for best/worst analysis (before filtering)`);
    
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
    
    const filteredItemsData = itemsData.filter(item => {
      return item.itemName && 
             item._sum.quantity && 
             item._sum.quantity > 0 &&
             !genericItems.includes(item.itemName) &&
             item.itemName.length > 3; // Exclude very short generic names
    });
    
    console.log(`📊 After filtering: ${filteredItemsData.length} valid items`);

    if (filteredItemsData.length === 0) {
      return createSuccessResponse({
        items: [],
        summary: {
          totalItems: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          dateRange: { start: null, end: null },
        },
        categories: {
          best: [],
          worst: [],
          middle: [],
        }
      });
    }

    // Process and categorize items
    const processedItems = filteredItemsData
      .filter(item => item.itemName) // Remove null items
      .map((item, index) => ({
        rank: index + 1,
        name: item.itemName!,
        totalQuantity: Number(item._sum.quantity || 0),
        totalRevenue: Number(item._sum.revenue || 0),
        recordCount: item._count._all,
        averagePerSale: item._count._all > 0 ? Number(item._sum.revenue || 0) / item._count._all : 0,
      }));

    // Calculate categories based on rankings
    const topCount = Math.min(20, Math.ceil(processedItems.length * 0.2));
    const bottomCount = Math.min(20, Math.ceil(processedItems.length * 0.2));

    const bestItems = processedItems.slice(0, topCount);
    const worstItems = processedItems.slice(-bottomCount).reverse(); // Reverse to show worst first
    const middleItems = processedItems.slice(topCount, processedItems.length - bottomCount);

    // Add performance categories to all items
    const categorizedItems = processedItems.map(item => ({
      ...item,
      performanceCategory: item.rank <= topCount ? 'best' : 
                          item.rank > processedItems.length - bottomCount ? 'worst' : 'middle'
    }));

    // Calculate summary statistics
    const totalRevenue = processedItems.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalQuantity = processedItems.reduce((sum, item) => sum + item.totalQuantity, 0);

    // Get date range from the actual data
    const dateRange = await calculateDateRange(where);

    return createSuccessResponse({
      items: categorizedItems,
      summary: {
        totalItems: processedItems.length,
        totalRevenue,
        totalQuantity,
        dateRange,
        sortBy,
        bestThreshold: topCount,
        worstThreshold: bottomCount,
      },
      categories: {
        best: bestItems,
        worst: worstItems,
        middle: middleItems.slice(0, 20), // Limit middle items for display
      },
      stats: {
        bestPerformance: {
          avgRevenue: bestItems.length > 0 ? bestItems.reduce((sum, item) => sum + item.totalRevenue, 0) / bestItems.length : 0,
          avgQuantity: bestItems.length > 0 ? bestItems.reduce((sum, item) => sum + item.totalQuantity, 0) / bestItems.length : 0,
        },
        worstPerformance: {
          avgRevenue: worstItems.length > 0 ? worstItems.reduce((sum, item) => sum + item.totalRevenue, 0) / worstItems.length : 0,
          avgQuantity: worstItems.length > 0 ? worstItems.reduce((sum, item) => sum + item.totalQuantity, 0) / worstItems.length : 0,
        },
        revenueGap: bestItems.length > 0 && worstItems.length > 0 ? 
          bestItems[0].totalRevenue / (worstItems[worstItems.length - 1].totalRevenue || 1) : 1,
      }
    });

  } catch (error) {
    console.error('Best/Worst items analysis error:', error);
    return createErrorResponse('ANALYSIS_ERROR', 'Failed to analyze best/worst selling items', 500);
  }
}

async function calculateDateRange(where: any) {
  try {
    // Try Square data first
    const squareCount = await prisma.squareDailySales.count({ where });
    if (squareCount > 0) {
      const dateStats = await prisma.squareDailySales.aggregate({
        where,
        _min: { date: true },
        _max: { date: true },
      });
      return {
        start: dateStats._min.date ? dateStats._min.date.getTime() : null,
        end: dateStats._max.date ? dateStats._max.date.getTime() : null,
      };
    }
    
    // Fallback to SalesAggregate
    const dateStats = await prisma.salesAggregate.aggregate({
      where,
      _min: { date: true },
      _max: { date: true },
    });

    return {
      start: dateStats._min.date ? dateStats._min.date.getTime() : null,
      end: dateStats._max.date ? dateStats._max.date.getTime() : null,
    };
  } catch (error) {
    return { start: null, end: null };
  }
}

export const dynamic = 'force-dynamic';