import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get unique item names with their sales totals
    const itemsData = await prisma.salesAggregate.groupBy({
      by: ['itemName'],
      where: {
        itemName: { not: null },
      },
      _sum: {
        quantity: true,
        revenue: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 500, // Get all items before filtering generics
    });

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
    
    const filteredItemsData = itemsData.filter(item => 
      !genericItems.includes(item.itemName!) && 
      item.itemName && 
      item.itemName.length > 3
    );
    
    console.log('🔍 Items list - filtered out generics:', filteredItemsData.length, 'of', itemsData.length, 'items');
    
    const formattedItems = filteredItemsData.map(item => ({
      name: item.itemName!,
      totalQuantity: item._sum.quantity || 0,
      totalRevenue: item._sum.revenue || 0,
      recordCount: item._count.id,
    }));

    return createSuccessResponse({
      items: formattedItems,
      count: formattedItems.length,
    });

  } catch (error) {
    console.error('Items list error:', error);
    return createErrorResponse('ITEMS_LIST_ERROR', 'Failed to fetch items list', 500);
  }
}

export const dynamic = 'force-dynamic';