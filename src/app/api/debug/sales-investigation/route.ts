import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { PrismaClient } from '@prisma/client';

// Direct PrismaClient for debug endpoint
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const productName = searchParams.get('product') || 'Black Sea Salt';

    console.log(`🔍 Investigating sales data for: "${productName}"`);
    
    // 1. Search items table
    const items = await prisma.item.findMany({
      where: {
        name: {
          contains: productName,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        squareVariationId: true,
        squareCatalogId: true,
        sku: true,
        barcode: true
      }
    });
    
    console.log(`📦 Found ${items.length} items matching "${productName}"`);
    
    // 2. Search sales data by item name
    const salesByName = await prisma.squareDailySales.findMany({
      where: {
        itemName: {
          contains: productName,
          mode: 'insensitive'
        }
      },
      select: {
        itemName: true,
        variationName: true,
        date: true,
        quantitySold: true,
        grossSalesCents: true,
        squareCatalogId: true
      },
      orderBy: { date: 'desc' }
    });
    
    console.log(`💰 Found ${salesByName.length} sales records by name`);
    
    // 3. If we have items, search sales by Square catalog ID too
    let salesByCatalogId: any[] = [];
    if (items.length > 0) {
      const catalogIds = items.map(i => i.squareCatalogId).filter(Boolean);
      if (catalogIds.length > 0) {
        salesByCatalogId = await prisma.squareDailySales.findMany({
          where: {
            squareCatalogId: {
              in: catalogIds
            }
          },
          select: {
            itemName: true,
            variationName: true,
            date: true,
            quantitySold: true,
            grossSalesCents: true,
            squareCatalogId: true
          },
          orderBy: { date: 'desc' }
        });
        
        console.log(`🆔 Found ${salesByCatalogId.length} sales records by catalog ID`);
      }
    }
    
    // 4. Get a sample of all sales data to see patterns
    const sampleSales = await prisma.squareDailySales.findMany({
      where: {
        itemName: {
          contains: 'Salt',
          mode: 'insensitive'
        }
      },
      take: 20,
      orderBy: { date: 'desc' },
      select: {
        itemName: true,
        variationName: true,
        date: true,
        quantitySold: true,
        grossSalesCents: true
      }
    });
    
    console.log(`📊 Found ${sampleSales.length} sample salt-related sales`);
    
    // 5. Check date range of sales data
    const salesDateRange = await prisma.squareDailySales.aggregate({
      _min: { date: true },
      _max: { date: true },
      _count: { id: true }
    });
    
    console.log('📅 Sales date range:', salesDateRange);

    return createSuccessResponse({
      searchTerm: productName,
      items,
      salesByName,
      salesByCatalogId,
      sampleSales,
      salesDateRange,
      summary: {
        itemsFound: items.length,
        salesByNameFound: salesByName.length,
        salesByCatalogIdFound: salesByCatalogId.length,
        totalSalesRecords: salesDateRange._count.id,
        dateRange: {
          earliest: salesDateRange._min.date,
          latest: salesDateRange._max.date
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Sales investigation error:', error);
    return createErrorResponse('SALES_INVESTIGATION_ERROR', error.message, 500);
  } finally {
    await prisma.$disconnect();
  }
}