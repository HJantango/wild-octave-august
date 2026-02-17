import { NextRequest, NextResponse } from 'next/server';
import { realSquareService } from '@/services/real-square-service';

// This endpoint is protected by a secret key instead of user auth
const CRON_SECRET = process.env.CRON_SECRET || 'wild-octave-sync-2024';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// Create prisma client at runtime using dynamic import
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

export async function GET(request: NextRequest) {
  // Check cron secret
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '') || 
                         request.nextUrl.searchParams.get('key');
  
  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    catalogSync: null,
    salesSync: null,
    errors: [],
  };

  const prisma = await getPrisma();

  try {
    // ========================================
    // 1. CATALOG SYNC - Mirror Square catalog
    // ========================================
    console.log('🔄 Starting catalog sync...');
    const catalogItems = await realSquareService.getCatalogItems();
    let catalogCreated = 0, catalogUpdated = 0, catalogSkipped = 0;

    for (const catalogItem of catalogItems) {
      try {
        const squareCatalogId = catalogItem.id;
        const defaultVariation = catalogItem.variations[0];
        const squareVariationId = defaultVariation?.id;
        
        // Get pricing from Square (exactly as Square provides)
        const priceAmount = defaultVariation?.priceMoney?.amount || 0;
        const sellIncGst = priceAmount / 100;
        const sellExGst = sellIncGst / 1.1;
        
        // Get cost from Square (exactly as Square provides)
        const costAmount = defaultVariation?.costMoney?.amount || 0;
        const costExGst = costAmount / 100;
        const markup = costExGst > 0 && sellExGst > 0 ? sellExGst / costExGst : 0;

        // Find existing item by Square ID first, then by name
        let existingItem = await prisma.item.findFirst({
          where: { squareCatalogId },
        });
        
        if (!existingItem) {
          existingItem = await prisma.item.findFirst({
            where: { name: { equals: catalogItem.name, mode: 'insensitive' } },
          });
        }

        if (existingItem) {
          // Update existing item with Square data
          const updateData: any = {
            squareCatalogId,
            squareVariationId,
          };

          if (sellIncGst > 0) {
            updateData.currentSellIncGst = sellIncGst;
            updateData.currentSellExGst = sellExGst;
          }
          
          if (costExGst > 0) {
            updateData.currentCostExGst = costExGst;
            updateData.currentMarkup = markup;
          }
          
          if (defaultVariation?.sku && !existingItem.sku) {
            updateData.sku = defaultVariation.sku;
          }

          await prisma.item.update({ 
            where: { id: existingItem.id }, 
            data: updateData 
          });
          catalogUpdated++;
        } else {
          // Create new item linked to Square
          await prisma.item.create({
            data: {
              squareCatalogId,
              squareVariationId,
              name: catalogItem.name,
              category: catalogItem.category?.name || 'Uncategorized',
              currentSellIncGst: sellIncGst,
              currentSellExGst: sellExGst,
              currentCostExGst: costExGst,
              currentMarkup: markup,
              sku: defaultVariation?.sku || undefined,
            },
          });
          catalogCreated++;
        }
      } catch (err: any) {
        results.errors.push({ phase: 'catalog', item: catalogItem.name, error: err.message });
      }
    }

    results.catalogSync = {
      total: catalogItems.length,
      created: catalogCreated,
      updated: catalogUpdated,
      skipped: catalogSkipped,
    };
    console.log(`✅ Catalog: ${catalogCreated} created, ${catalogUpdated} updated`);

    // ========================================
    // 2. SALES SYNC - Sync daily sales from Square orders
    // ========================================
    console.log('🔄 Starting sales sync...');
    
    // Sync last 7 days to catch any missed days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const orders = await realSquareService.searchOrders({
      startDate,
      endDate,
    });

    console.log(`📊 Found ${orders.length} orders in last 7 days`);

    // Build daily aggregates from orders
    const dailyAggregates = new Map<string, {
      date: Date;
      itemName: string;
      variationName: string;
      category: string | null;
      vendorName: string | null;
      quantitySold: number;
      grossSalesCents: number;
      netSalesCents: number;
      squareCatalogId: string | null;
    }>();

    for (const order of orders) {
      if (!order.lineItems) continue;
      
      const orderDate = new Date(order.createdAt);
      const dateKey = orderDate.toISOString().split('T')[0];
      
      for (const lineItem of order.lineItems) {
        const itemName = lineItem.name || 'Unknown Item';
        const variationName = lineItem.variationName || '';
        const key = `${dateKey}::${itemName}::${variationName}`;
        
        const existing = dailyAggregates.get(key) || {
          date: new Date(dateKey),
          itemName,
          variationName,
          category: lineItem.categoryName || null,
          vendorName: null, // Would need to lookup
          quantitySold: 0,
          grossSalesCents: 0,
          netSalesCents: 0,
          squareCatalogId: lineItem.catalogObjectId || null,
        };
        
        existing.quantitySold += Number(lineItem.quantity) || 0;
        existing.grossSalesCents += Number(lineItem.grossSalesMoney?.amount) || 0;
        existing.netSalesCents += Number(lineItem.netSalesMoney?.amount) || 0;
        
        dailyAggregates.set(key, existing);
      }
    }

    console.log(`📊 Aggregated into ${dailyAggregates.size} daily records`);

    // Upsert daily sales records
    let salesCreated = 0, salesUpdated = 0;

    for (const record of dailyAggregates.values()) {
      try {
        await prisma.squareDailySales.upsert({
          where: {
            unique_daily_item_variation: {
              date: record.date,
              itemName: record.itemName,
              variationName: record.variationName,
            },
          },
          create: {
            date: record.date,
            itemName: record.itemName,
            variationName: record.variationName,
            category: record.category,
            vendorName: record.vendorName,
            quantitySold: record.quantitySold,
            grossSalesCents: record.grossSalesCents,
            netSalesCents: record.netSalesCents,
            squareCatalogId: record.squareCatalogId,
          },
          update: {
            category: record.category,
            quantitySold: record.quantitySold,
            grossSalesCents: record.grossSalesCents,
            netSalesCents: record.netSalesCents,
            squareCatalogId: record.squareCatalogId,
          },
        });
        salesCreated++; // Upsert counts as created for simplicity
      } catch (err: any) {
        results.errors.push({ phase: 'sales', item: record.itemName, error: err.message });
      }
    }

    results.salesSync = {
      ordersProcessed: orders.length,
      dailyRecords: dailyAggregates.size,
      upserted: salesCreated,
    };
    console.log(`✅ Sales: ${salesCreated} records upserted`);

    // Final result
    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    console.error('❌ Daily sync failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
