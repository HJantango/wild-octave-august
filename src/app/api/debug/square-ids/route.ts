import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Count items with and without Square catalog IDs
    const totalItems = await prisma.item.count();
    const itemsWithSquareId = await prisma.item.count({
      where: { squareCatalogId: { not: null } },
    });
    const itemsWithoutSquareId = totalItems - itemsWithSquareId;

    // Count sales records with Square catalog IDs
    const totalSales = await prisma.squareDailySales.count();
    const salesWithSquareId = await prisma.squareDailySales.count({
      where: { squareCatalogId: { not: null } },
    });

    // Check the specific problematic items
    const carobItem = await prisma.item.findFirst({
      where: { name: { contains: 'ACC Organic Carob', mode: 'insensitive' } },
      select: { name: true, squareCatalogId: true, vendor: { select: { name: true } } },
    });

    const carobSales = await prisma.squareDailySales.findMany({
      where: { itemName: { contains: 'carob powder', mode: 'insensitive' } },
      select: { itemName: true, squareCatalogId: true, quantitySold: true, date: true },
      take: 5,
      orderBy: { date: 'desc' },
    });

    const saltItem = await prisma.item.findFirst({
      where: { name: { contains: 'Black Sea Salt', mode: 'insensitive' } },
      select: { name: true, squareCatalogId: true, vendor: { select: { name: true } } },
    });

    const saltSales = await prisma.squareDailySales.findMany({
      where: { 
        OR: [
          { itemName: { contains: 'black sea salt', mode: 'insensitive' } },
          { itemName: { contains: 'salt bulk', mode: 'insensitive' } },
        ]
      },
      select: { itemName: true, squareCatalogId: true, quantitySold: true, date: true },
      take: 10,
      orderBy: { date: 'desc' },
    });

    return createSuccessResponse({
      summary: {
        totalItems,
        itemsWithSquareId,
        itemsWithoutSquareId,
        squareIdCoverage: `${((itemsWithSquareId / totalItems) * 100).toFixed(1)}%`,
        totalSales,
        salesWithSquareId,
        salesSquareIdCoverage: `${((salesWithSquareId / totalSales) * 100).toFixed(1)}%`,
      },
      problematicItems: {
        carob: {
          item: carobItem,
          salesFound: carobSales,
        },
        salt: {
          item: saltItem,
          salesFound: saltSales,
        },
      },
      message: `${itemsWithoutSquareId} items missing Square catalog IDs. ${totalSales - salesWithSquareId} sales without Square IDs.`,
    });

  } catch (error) {
    console.error('Square ID check error:', error);
    return createErrorResponse('DIAGNOSTIC_ERROR', `Failed to check Square IDs: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}

export const dynamic = 'force-dynamic';