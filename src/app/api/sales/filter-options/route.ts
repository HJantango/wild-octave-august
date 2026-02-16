import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const filterOptionsSchema = z.object({
  type: z.enum(['category', 'item']).default('category'),
  limit: z.number().min(1).max(1000).default(500),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    // Convert string values to appropriate types
    const processedParams = {
      ...searchParams,
      limit: searchParams.limit ? parseInt(searchParams.limit) : undefined,
    };

    const validation = validateRequest(filterOptionsSchema, processedParams);

    if (!validation.success) {
      return validation.error;
    }

    const { type, limit } = validation.data;

    console.log(`🔍 Fetching filter options for type: ${type}`);

    // Base filter to exclude Shelf Labels
    const baseWhere = {
      category: { not: 'Shelf Labels' }
    };

    // Check if Square data exists
    const squareDataCount = await prisma.squareDailySales.count({ where: baseWhere });
    const useSquareData = squareDataCount > 0;

    if (type === 'category') {
      let categoriesData: Array<{ name: string; totalQuantity: number; totalRevenue: number; recordCount: number }>;

      if (useSquareData) {
        // Use Square API data
        const categories = await prisma.squareDailySales.groupBy({
          by: ['category'],
          where: baseWhere,
          _sum: {
            quantitySold: true,
            netSalesCents: true,
          },
          _count: {
            _all: true,
          },
          orderBy: {
            _sum: { netSalesCents: 'desc' }
          },
          take: limit,
        });

        categoriesData = categories
          .filter(cat => cat.category)
          .map(cat => ({
            name: cat.category!,
            totalQuantity: Number(cat._sum.quantitySold || 0),
            totalRevenue: (cat._sum.netSalesCents || 0) / 100,
            recordCount: cat._count._all,
          }));
      } else {
        // Fallback to CSV data
        const categories = await prisma.salesAggregate.groupBy({
          by: ['category'],
          where: baseWhere,
          _sum: {
            quantity: true,
            revenue: true,
          },
          _count: {
            _all: true,
          },
          orderBy: {
            _sum: { revenue: 'desc' }
          },
          take: limit,
        });

        categoriesData = categories
          .filter(cat => cat.category)
          .map(cat => ({
            name: cat.category!,
            totalQuantity: Number(cat._sum.quantity || 0),
            totalRevenue: Number(cat._sum.revenue || 0),
            recordCount: cat._count._all,
          }));
      }

      console.log(`🔍 Found ${categoriesData.length} categories (excluding Shelf Labels, source: ${useSquareData ? 'Square' : 'CSV'})`);

      return createSuccessResponse({
        type: 'category',
        options: categoriesData,
        count: categoriesData.length,
      });
    } else {
      let items: any[];

      if (useSquareData) {
        // Use Square API data
        const squareItems = await prisma.squareDailySales.groupBy({
          by: ['itemName'],
          where: {
            ...baseWhere,
            itemName: { not: null }
          },
          _sum: {
            quantitySold: true,
            netSalesCents: true,
          },
          _count: {
            _all: true,
          },
          orderBy: {
            _sum: { netSalesCents: 'desc' }
          },
          take: limit,
        });

        items = squareItems.map(item => ({
          itemName: item.itemName,
          _sum: {
            quantity: item._sum.quantitySold,
            revenue: (item._sum.netSalesCents || 0) / 100,
          },
          _count: { _all: item._count._all },
        }));
      } else {
        // Fallback to CSV data
        items = await prisma.salesAggregate.groupBy({
          by: ['itemName'],
          where: {
            ...baseWhere,
            itemName: { not: null }
          },
          _sum: {
            quantity: true,
            revenue: true,
          },
          _count: {
            _all: true,
          },
          orderBy: {
            _sum: { revenue: 'desc' }
          },
          take: limit,
        });
      }

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
      
      const itemsData = items
        .filter(item => item.itemName && 
                      !genericItems.includes(item.itemName) && 
                      item.itemName.length > 3) // Remove null items and generics
        .map(item => ({
          name: item.itemName!,
          totalQuantity: Number(item._sum.quantity || 0),
          totalRevenue: Number(item._sum.revenue || 0),
          recordCount: item._count._all,
        }));

      console.log(`🔍 Found ${itemsData.length} items (excluding Shelf Labels, source: ${useSquareData ? 'Square' : 'CSV'})`);

      return createSuccessResponse({
        type: 'item',
        options: itemsData,
        count: itemsData.length,
      });
    }

  } catch (error) {
    console.error('Filter options error:', error);
    return createErrorResponse('FILTER_OPTIONS_ERROR', 'Failed to fetch filter options', 500);
  }
}

export const dynamic = 'force-dynamic';