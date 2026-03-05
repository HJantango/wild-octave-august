import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // 1. Find all Celtic salt items in Items table
    const items = await prisma.item.findMany({
      where: {
        AND: [
          { name: { contains: 'Celtic', mode: 'insensitive' } },
          { name: { contains: 'Salt', mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        name: true,
        squareCatalogId: true,
        squareVariationId: true,
      },
      orderBy: { name: 'asc' },
    });

    // 2. For each item, get sales from SquareDailySales by catalogId
    const itemsWithSales = await Promise.all(items.map(async (item) => {
      let salesByCatalogId = null;
      let salesByVariationId = null;
      
      if (item.squareCatalogId) {
        salesByCatalogId = await prisma.squareDailySales.aggregate({
          where: { squareCatalogId: item.squareCatalogId },
          _sum: { quantitySold: true, netSalesCents: true },
          _count: true,
        });
      }
      
      if (item.squareVariationId) {
        salesByVariationId = await prisma.squareDailySales.aggregate({
          where: { squareVariationId: item.squareVariationId },
          _sum: { quantitySold: true, netSalesCents: true },
          _count: true,
        });
      }
      
      return {
        item: {
          name: item.name,
          squareCatalogId: item.squareCatalogId,
          squareVariationId: item.squareVariationId,
        },
        salesByCatalogId: salesByCatalogId ? {
          units: salesByCatalogId._sum.quantitySold || 0,
          revenue: ((salesByCatalogId._sum.netSalesCents || 0) / 100).toFixed(2),
          records: salesByCatalogId._count,
        } : 'No Square catalog ID',
        salesByVariationId: salesByVariationId ? {
          units: salesByVariationId._sum.quantitySold || 0,
          revenue: ((salesByVariationId._sum.netSalesCents || 0) / 100).toFixed(2),
          records: salesByVariationId._count,
        } : 'No variation ID',
      };
    }));

    // 3. Find ALL Celtic salt entries in SquareDailySales (might have different catalog IDs)
    const allSaltSales = await prisma.squareDailySales.findMany({
      where: {
        OR: [
          { productName: { contains: 'Celtic', mode: 'insensitive' } },
          { itemName: { contains: 'Celtic', mode: 'insensitive' } },
        ]
      },
      distinct: ['squareCatalogId'],
      select: {
        squareCatalogId: true,
        squareVariationId: true,
        productName: true,
        itemName: true,
      },
    });

    // 4. Get totals for each unique catalogId found in sales
    const salesByCatalogId = await Promise.all(allSaltSales.map(async (sale) => {
      const totals = await prisma.squareDailySales.aggregate({
        where: { squareCatalogId: sale.squareCatalogId },
        _sum: { quantitySold: true, netSalesCents: true, grossSalesCents: true },
      });
      
      // Check if this catalogId is linked to any Item
      const linkedItem = await prisma.item.findFirst({
        where: { squareCatalogId: sale.squareCatalogId },
        select: { name: true },
      });
      
      return {
        productName: sale.productName || sale.itemName,
        squareCatalogId: sale.squareCatalogId,
        squareVariationId: sale.squareVariationId,
        totalUnits: totals._sum.quantitySold || 0,
        netRevenue: ((totals._sum.netSalesCents || 0) / 100).toFixed(2),
        grossRevenue: ((totals._sum.grossSalesCents || 0) / 100).toFixed(2),
        linkedToItem: linkedItem?.name || 'NOT LINKED',
      };
    }));

    return NextResponse.json({
      itemsTable: itemsWithSales,
      salesTable: salesByCatalogId,
      diagnosis: {
        totalItemsFound: items.length,
        totalSalesCatalogIds: allSaltSales.length,
        possibleIssue: items.length !== allSaltSales.length 
          ? 'Mismatch between Items and Sales catalog IDs - some sales may not be linked'
          : 'Counts match',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
