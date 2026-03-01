import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get sample Square catalog IDs from sales data
    const salesSample = await prisma.squareDailySales.findMany({
      select: { squareCatalogId: true, itemName: true },
      where: { squareCatalogId: { not: null } },
      distinct: ['squareCatalogId'],
      take: 10,
    });

    // Get sample Square catalog IDs from items
    const itemsSample = await prisma.item.findMany({
      select: { squareCatalogId: true, name: true },
      where: { squareCatalogId: { not: null } },
      take: 10,
    });

    // Check if any sales catalog IDs match any item catalog IDs
    const salesIds = new Set(salesSample.map(s => s.squareCatalogId).filter(Boolean));
    const itemIds = new Set(itemsSample.map(i => i.squareCatalogId).filter(Boolean));
    
    const matches = [...salesIds].filter(id => itemIds.has(id));

    // Get count stats
    const totalSalesIds = await prisma.squareDailySales.groupBy({
      by: ['squareCatalogId'],
      where: { squareCatalogId: { not: null } },
      _count: true,
    });

    const totalItemIds = await prisma.item.count({
      where: { squareCatalogId: { not: null } },
    });

    return createSuccessResponse({
      salesSample: salesSample.map(s => ({ id: s.squareCatalogId, name: s.itemName })),
      itemsSample: itemsSample.map(i => ({ id: i.squareCatalogId, name: i.name })),
      totalSalesWithIds: totalSalesIds.length,
      totalItemsWithIds: totalItemIds,
      matches: matches.length,
      matchingIds: matches.slice(0, 5),
      diagnosis: matches.length === 0 
        ? "NO MATCHES: Sales and Items have completely different Square catalog IDs" 
        : `${matches.length} matching IDs found - partial sync issue`,
    });
  } catch (error: any) {
    return createSuccessResponse({
      error: error.message,
      diagnosis: "Database query failed",
    });
  }
}

export const dynamic = 'force-dynamic';