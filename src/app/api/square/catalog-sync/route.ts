import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { realSquareService } from '@/services/real-square-service';

export async function POST(request: NextRequest) {
  try {
    // 1. First sync vendors from Square
    console.log('📦 Syncing vendors from Square...');
    const squareVendors = await realSquareService.getVendors();
    const vendorMap = new Map<string, string>(); // squareVendorId -> dbVendorId
    let vendorsCreated = 0;
    let vendorsExisting = 0;

    for (const squareVendor of squareVendors) {
      // Check if vendor exists by name
      let dbVendor = await prisma.vendor.findFirst({
        where: { name: { equals: squareVendor.name, mode: 'insensitive' } },
      });

      if (!dbVendor) {
        // Create new vendor
        dbVendor = await prisma.vendor.create({
          data: { name: squareVendor.name },
        });
        vendorsCreated++;
        console.log(`✅ Created vendor: ${squareVendor.name}`);
      } else {
        vendorsExisting++;
      }
      
      vendorMap.set(squareVendor.id, dbVendor.id);
    }
    console.log(`📦 Vendors: ${vendorsCreated} created, ${vendorsExisting} existing`);

    // 2. Fetch catalog items from Square API (now includes vendor info)
    const catalogItems = await realSquareService.getCatalogItems();

    if (catalogItems.length === 0) {
      return createSuccessResponse({
        summary: { 
          total: 0, created: 0, updated: 0, skipped: 0, errors: 0,
          vendorsCreated, vendorsExisting,
        },
        details: { created: [], updated: [], skipped: [], errors: [] },
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const createdItems: any[] = [];
    const updatedItems: any[] = [];
    const skippedItems: any[] = [];
    const errorItems: any[] = [];

    for (const catalogItem of catalogItems) {
      try {
        // Get vendor DB ID if item has a vendor in Square
        const dbVendorId = catalogItem.vendorId ? vendorMap.get(catalogItem.vendorId) : undefined;

        // Check if item already exists by name
        const existingItem = await prisma.item.findFirst({
          where: { name: { equals: catalogItem.name, mode: 'insensitive' } },
        });

        if (existingItem) {
          // Item already exists - update pricing/cost/vendor if available
          const defaultVariation = catalogItem.variations[0];
          const priceAmount = defaultVariation?.priceMoney?.amount || 0;
          const priceInDollars = priceAmount / 100;
          const costAmount = defaultVariation?.costMoney?.amount || 0;
          const costInDollars = costAmount / 100;

          const updateData: any = {};
          let updateActions: string[] = [];

          // Update sell price if we have one and existing is 0
          if (priceInDollars > 0 && Number(existingItem.currentSellIncGst) === 0) {
            updateData.currentSellIncGst = priceInDollars;
            updateData.currentSellExGst = priceInDollars / 1.1;
            updateActions.push('sell_price');
          }

          // Update cost if we have one from Square
          if (costInDollars > 0) {
            updateData.currentCostExGst = costInDollars;
            updateActions.push('cost');
            if (priceInDollars > 0) {
              const sellExGst = priceInDollars / 1.1;
              updateData.currentMarkup = sellExGst / costInDollars;
            }
          }

          // Update SKU if available
          if (defaultVariation?.sku && !existingItem.sku) {
            updateData.sku = defaultVariation.sku;
            updateActions.push('sku');
          }

          // Update vendor if we have one and item doesn't have one
          if (dbVendorId && !existingItem.vendorId) {
            updateData.vendorId = dbVendorId;
            updateActions.push('vendor');
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.item.update({
              where: { id: existingItem.id },
              data: updateData,
            });
            updated++;
            updatedItems.push({ 
              name: catalogItem.name, 
              action: updateActions.join('+'),
              vendor: catalogItem.vendorName,
              cost: costInDollars > 0 ? costInDollars : undefined,
              price: priceInDollars > 0 ? priceInDollars : undefined,
            });
          } else {
            skipped++;
            skippedItems.push({ name: catalogItem.name, reason: 'no_changes' });
          }
        } else {
          // Create new item
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
              vendorId: dbVendorId || undefined,
            },
          });
          created++;
          createdItems.push({
            name: catalogItem.name,
            price: priceInDollars,
            cost: costInDollars > 0 ? costInDollars : undefined,
            category: catalogItem.category?.name,
            vendor: catalogItem.vendorName,
          });
        }
      } catch (err: any) {
        errors++;
        errorItems.push({ name: catalogItem.name, error: err.message });
      }
    }

    return createSuccessResponse({
      summary: {
        total: catalogItems.length,
        created,
        updated,
        skipped,
        errors,
        vendorsCreated,
        vendorsExisting,
        squareVendors: squareVendors.length,
      },
      details: {
        created: createdItems,
        updated: updatedItems,
        skipped: skippedItems.slice(0, 10), // Limit skipped to first 10
        errors: errorItems,
      },
    });
  } catch (error: any) {
    console.error('❌ Catalog sync error:', error);
    return createErrorResponse(
      'CATALOG_SYNC_ERROR',
      `Failed to sync catalog: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
