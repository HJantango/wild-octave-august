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

  // Create prisma client at runtime (dynamic import to avoid build-time issues)
  const prisma = await getPrisma();

  try {
    // 1. Sync catalog items
    console.log('🔄 Starting catalog sync...');
    const catalogItems = await realSquareService.getCatalogItems();
    let catalogCreated = 0, catalogUpdated = 0, catalogSkipped = 0;

    for (const catalogItem of catalogItems) {
      try {
        const existingItem = await prisma.item.findFirst({
          where: { name: { equals: catalogItem.name, mode: 'insensitive' } },
        });

        if (existingItem) {
          const defaultVariation = catalogItem.variations[0];
          const priceAmount = defaultVariation?.priceMoney?.amount || 0;
          const priceInDollars = priceAmount / 100;
          const costAmount = defaultVariation?.costMoney?.amount || 0;
          const costInDollars = costAmount / 100;

          const updateData: any = {};
          if (priceInDollars > 0 && Number(existingItem.currentSellIncGst) === 0) {
            updateData.currentSellIncGst = priceInDollars;
            updateData.currentSellExGst = priceInDollars / 1.1;
          }
          if (costInDollars > 0) {
            updateData.currentCostExGst = costInDollars;
            if (priceInDollars > 0) {
              updateData.currentMarkup = (priceInDollars / 1.1) / costInDollars;
            }
          }
          if (defaultVariation?.sku && !existingItem.sku) {
            updateData.sku = defaultVariation.sku;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.item.update({ where: { id: existingItem.id }, data: updateData });
            catalogUpdated++;
          } else {
            catalogSkipped++;
          }
        } else {
          const defaultVariation = catalogItem.variations[0];
          const priceAmount = defaultVariation?.priceMoney?.amount || 0;
          const priceInDollars = priceAmount / 100;
          const costAmount = defaultVariation?.costMoney?.amount || 0;
          const costInDollars = costAmount / 100;
          const sellExGst = priceInDollars / 1.1;
          const markup = costInDollars > 0 ? sellExGst / costInDollars : 0;

          await prisma.item.create({
            data: {
              name: catalogItem.name,
              category: catalogItem.category?.name || 'Uncategorized',
              currentSellIncGst: priceInDollars,
              currentSellExGst: sellExGst,
              currentCostExGst: costInDollars,
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
    console.log(`✅ Catalog sync: ${catalogCreated} created, ${catalogUpdated} updated, ${catalogSkipped} skipped`);

    // 2. Sync sales data
    // Use weeks param for historical sync, default to 1 week for daily cron
    const weeksBack = parseInt(request.nextUrl.searchParams.get('weeks') || '1');
    console.log(`🔄 Starting sales sync (${weeksBack} weeks back)...`);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);

    const orders = await realSquareService.searchOrders({
      startDate,
      endDate,
    });

    // Get vendor lookup from items
    const dbItems = await prisma.item.findMany({
      select: { name: true, vendor: { select: { name: true } } },
    });
    const vendorLookup = new Map<string, string>();
    for (const dbItem of dbItems) {
      if (dbItem.vendor?.name) {
        vendorLookup.set(dbItem.name.toLowerCase().trim(), dbItem.vendor.name);
      }
    }

    // Aggregate by day/item
    const aggregated = new Map<string, any>();
    for (const order of orders) {
      if (!order.lineItems) continue;
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toISOString().split('T')[0];

      for (const item of order.lineItems) {
        const itemName = item.name || 'Unknown Item';
        const variationName = item.variationName || '';
        const key = `${dateStr}|${itemName}|${variationName}`;

        const quantity = parseFloat(item.quantity || '0');
        const grossCents = Number(item.totalMoney?.amount || 0);
        const taxCents = Number(item.totalTaxMoney?.amount || 0);

        if (aggregated.has(key)) {
          const existing = aggregated.get(key);
          existing.quantitySold += quantity;
          existing.grossSalesCents += grossCents;
          existing.netSalesCents += (grossCents - taxCents);
        } else {
          aggregated.set(key, {
            date: new Date(dateStr + 'T00:00:00.000Z'),
            itemName,
            variationName,
            quantitySold: quantity,
            grossSalesCents: grossCents,
            netSalesCents: grossCents - taxCents,
          });
        }
      }
    }

    // Upsert sales records
    let salesUpserted = 0;
    for (const entry of aggregated.values()) {
      const vendorName = vendorLookup.get(entry.itemName.toLowerCase().trim()) || null;
      await prisma.squareDailySales.upsert({
        where: {
          unique_daily_item_variation: {
            date: entry.date,
            itemName: entry.itemName,
            variationName: entry.variationName,
          },
        },
        update: {
          vendorName,
          quantitySold: entry.quantitySold,
          grossSalesCents: entry.grossSalesCents,
          netSalesCents: entry.netSalesCents,
        },
        create: {
          date: entry.date,
          itemName: entry.itemName,
          variationName: entry.variationName,
          vendorName,
          quantitySold: entry.quantitySold,
          grossSalesCents: entry.grossSalesCents,
          netSalesCents: entry.netSalesCents,
        },
      });
      salesUpserted++;
    }

    results.salesSync = {
      ordersProcessed: orders.length,
      recordsUpserted: salesUpserted,
      dateRange: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0] },
    };
    console.log(`✅ Sales sync: ${orders.length} orders → ${salesUpserted} daily records`);

    await prisma.$disconnect();
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error('❌ Daily sync failed:', error);
    results.errors.push({ phase: 'general', error: error.message });
    await prisma.$disconnect();
    return NextResponse.json({
      success: false,
      ...results,
    }, { status: 500 });
  }
}
