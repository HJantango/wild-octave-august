import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Count items with and without Square catalog IDs
    const itemStats = await prisma.item.aggregate({
      _count: { id: true },
    });
    
    const itemsWithSquareId = await prisma.item.count({
      where: { squareCatalogId: { not: null } },
    });
    
    const itemsWithoutSquareId = await prisma.item.count({
      where: { squareCatalogId: null },
    });

    // Count sales records with Square catalog IDs
    const salesWithSquareId = await prisma.squareDailySales.count({
      where: { squareCatalogId: { not: null } },
    });
    
    const totalSalesRecords = await prisma.squareDailySales.count();

    // Get sample items without Square IDs
    const sampleItemsWithoutIds = await prisma.item.findMany({
      where: { squareCatalogId: null },
      select: { id: true, name: true, vendor: { select: { name: true } } },
      take: 10,
      orderBy: { name: 'asc' },
    });

    // Get sample items WITH Square IDs for comparison
    const sampleItemsWithIds = await prisma.item.findMany({
      where: { squareCatalogId: { not: null } },
      select: { id: true, name: true, squareCatalogId: true, vendor: { select: { name: true } } },
      take: 10,
      orderBy: { name: 'asc' },
    });

    // Check specific problematic items
    const problematicItems = [
      'ACC Organic Carob Powder Raw 200g',
      'Black Sea Salt Flakes 180g',
    ];

    const problematicItemDetails = await Promise.all(
      problematicItems.map(async (itemName) => {
        const item = await prisma.item.findFirst({
          where: { name: { equals: itemName, mode: 'insensitive' } },
          select: { id: true, name: true, squareCatalogId: true, vendor: { select: { name: true } } },
        });

        // Check for sales under this exact name
        const salesExact = await prisma.squareDailySales.findMany({
          where: { itemName: { equals: itemName, mode: 'insensitive' } },
          select: { date: true, itemName: true, quantitySold: true, squareCatalogId: true },
          take: 3,
          orderBy: { date: 'desc' },
        });

        // Check for sales with similar names
        const nameParts = itemName.split(' ').filter(part => part.length > 3);
        const salesSimilar = await prisma.squareDailySales.findMany({
          where: {
            OR: nameParts.map(part => ({
              itemName: { contains: part, mode: 'insensitive' }
            }))
          },
          select: { date: true, itemName: true, quantitySold: true, squareCatalogId: true },
          take: 5,
          orderBy: { date: 'desc' },
        });

        return {
          itemName,
          item,
          salesExact,
          salesSimilar: salesSimilar.filter(s => 
            !salesExact.some(e => e.itemName === s.itemName)
          ),
        };
      })
    );

    // Get unique item names from sales that don't have matching items
    const orphanSalesQuery = `
      SELECT s.item_name, s.square_catalog_id, COUNT(*) as sales_count, SUM(s.quantity_sold) as total_quantity
      FROM square_daily_sales s
      LEFT JOIN items i ON s.square_catalog_id = i.square_catalog_id
      WHERE i.id IS NULL AND s.square_catalog_id IS NOT NULL
      GROUP BY s.item_name, s.square_catalog_id
      ORDER BY sales_count DESC
      LIMIT 10
    `;

    return createSuccessResponse({
      summary: {
        totalItems: itemStats._count.id,
        itemsWithSquareId: itemsWithSquareId,
        itemsWithoutSquareId: itemsWithoutSquareId,
        squareIdCoverage: `${((itemsWithSquareId / itemStats._count.id) * 100).toFixed(1)}%`,
        totalSalesRecords: totalSalesRecords,
        salesWithSquareId: salesWithSquareId,
        salesSquareIdCoverage: `${((salesWithSquareId / totalSalesRecords) * 100).toFixed(1)}%`,
      },
      samples: {
        itemsWithoutIds: sampleItemsWithoutIds,
        itemsWithIds: sampleItemsWithIds,
      },
      problematicItems,
      message: `${itemsWithoutSquareId} items need Square catalog ID mapping. ${totalSalesRecords - salesWithSquareId} sales records have no Square catalog ID.`,
    });

  } catch (error) {
    console.error('Square ID coverage check error:', error);
    return createErrorResponse('DIAGNOSTIC_ERROR', `Failed to check Square ID coverage: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}

export const dynamic = 'force-dynamic';