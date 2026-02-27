import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Examining existing sales data fields...');

    // Get a sample of carob sales to examine
    const carobSales = await prisma.squareDailySales.findMany({
      where: { itemName: { contains: 'carob', mode: 'insensitive' } },
      take: 5,
      orderBy: { date: 'desc' },
    });

    // Get a sample of salt sales to examine  
    const saltSales = await prisma.squareDailySales.findMany({
      where: { itemName: { contains: 'salt', mode: 'insensitive' } },
      take: 5,
      orderBy: { date: 'desc' },
    });

    // Get the ACC Carob item from items table
    const accCarobItem = await prisma.item.findFirst({
      where: { name: { contains: 'ACC Organic Carob', mode: 'insensitive' } },
    });

    // Get the Black Sea Salt item from items table
    const saltItem = await prisma.item.findFirst({
      where: { name: { contains: 'Black Sea Salt', mode: 'insensitive' } },
    });

    // Check what unique square catalog IDs exist in sales vs items
    const salesCatalogIds = await prisma.squareDailySales.findMany({
      where: { squareCatalogId: { not: null } },
      select: { squareCatalogId: true, itemName: true },
      distinct: ['squareCatalogId'],
      take: 10,
    });

    const itemsCatalogIds = await prisma.item.findMany({
      where: { squareCatalogId: { not: null } },
      select: { squareCatalogId: true, name: true },
      take: 10,
    });

    // Check for overlap between ACC carob and 108 carob catalog IDs
    const carobCatalogIds = carobSales
      .filter(s => s.squareCatalogId)
      .map(s => ({ catalogId: s.squareCatalogId, name: s.itemName }));

    return createSuccessResponse({
      analysis: {
        accCarobItem: accCarobItem ? {
          name: accCarobItem.name,
          squareCatalogId: accCarobItem.squareCatalogId,
          hasSquareId: !!accCarobItem.squareCatalogId,
        } : null,
        saltItem: saltItem ? {
          name: saltItem.name,
          squareCatalogId: saltItem.squareCatalogId,
          hasSquareId: !!saltItem.squareCatalogId,
        } : null,
      },
      carobSalesData: carobSales.map(s => ({
        date: s.date,
        itemName: s.itemName,
        squareCatalogId: s.squareCatalogId,
        quantity: s.quantitySold,
        hasSquareId: !!s.squareCatalogId,
      })),
      saltSalesData: saltSales.map(s => ({
        date: s.date,
        itemName: s.itemName,
        squareCatalogId: s.squareCatalogId,
        quantity: s.quantitySold,
        hasSquareId: !!s.squareCatalogId,
      })),
      carobCatalogIdAnalysis: {
        uniqueCatalogIdsInSales: carobCatalogIds,
        accCarobCatalogId: accCarobItem?.squareCatalogId,
        doTheyMatch: carobCatalogIds.some(c => c.catalogId === accCarobItem?.squareCatalogId),
      },
      sampleCatalogIds: {
        fromSales: salesCatalogIds,
        fromItems: itemsCatalogIds,
      },
      databaseSchema: {
        salesTableFields: ['id', 'date', 'itemName', 'variationName', 'category', 'vendorName', 'quantitySold', 'grossSalesCents', 'netSalesCents', 'squareCatalogId', 'createdAt', 'updatedAt'],
        itemsTableFields: ['id', 'squareCatalogId', 'squareVariationId', 'name', 'vendorId', 'category', 'subcategory', 'currentCostExGst', 'currentMarkup', 'currentSellExGst', 'currentSellIncGst', 'sku', 'barcode', 'createdAt', 'updatedAt'],
        missingReferenceHandle: 'Both tables are missing referenceHandle field that Heath identified!',
      },
    });

  } catch (error) {
    console.error('❌ Sales data examination error:', error);
    return createErrorResponse(
      'EXAMINATION_ERROR',
      `Failed to examine sales data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';