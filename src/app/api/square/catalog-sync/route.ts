import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { realSquareService } from '@/services/real-square-service';

// Secret key for unauthenticated access (same as cron)
const SYNC_SECRET = process.env.CRON_SECRET || 'wild-octave-sync-2024';

/**
 * Square Catalog Sync - Mirrors Square catalog to local database
 * 
 * Key principles:
 * - Square is the source of truth
 * - Items are linked by Square catalog ID (not name matching)
 * - Prices are stored exactly as Square provides them (no transforms)
 * - Cost data from Square vendor info is stored as-is
 * 
 * Can be called with ?key=<secret> to bypass auth
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Check for secret key to bypass auth (for cron/remote calls)
  const providedKey = request.nextUrl.searchParams.get('key');
  // Note: If no key provided, the middleware will handle auth
  // If key matches, we proceed (key check is optional - middleware handles auth otherwise)
  
  try {
    // 1. Sync vendors from Square
    console.log('📦 Starting Square catalog sync...');
    const squareVendors = await realSquareService.getVendors();
    const vendorMap = new Map<string, string>(); // squareVendorId -> dbVendorId
    let vendorsCreated = 0;
    let vendorsExisting = 0;

    for (const squareVendor of squareVendors) {
      let dbVendor = await prisma.vendor.findFirst({
        where: { name: { equals: squareVendor.name, mode: 'insensitive' } },
      });

      if (!dbVendor) {
        dbVendor = await prisma.vendor.create({
          data: { name: squareVendor.name },
        });
        vendorsCreated++;
      } else {
        vendorsExisting++;
      }
      
      vendorMap.set(squareVendor.id, dbVendor.id);
    }
    console.log(`📦 Vendors: ${vendorsCreated} created, ${vendorsExisting} existing`);

    // 2. Fetch catalog items from Square
    const catalogItems = await realSquareService.getCatalogItems();
    console.log(`📦 Found ${catalogItems.length} items in Square catalog`);

    if (catalogItems.length === 0) {
      return createSuccessResponse({
        summary: { 
          total: 0, created: 0, updated: 0, skipped: 0, errors: 0,
          vendorsCreated, vendorsExisting,
        },
        details: { created: [], updated: [], skipped: [], errors: [] },
        tookMs: Date.now() - startTime,
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
        const squareCatalogId = catalogItem.id;
        const defaultVariation = catalogItem.variations[0];
        const squareVariationId = defaultVariation?.id;
        
        // Get pricing from Square (stored exactly as Square provides)
        const priceAmount = defaultVariation?.priceMoney?.amount || 0;
        const sellIncGst = priceAmount / 100; // Square stores in cents
        const sellExGst = sellIncGst / 1.1;
        
        // Get cost from Square vendor info (stored exactly as Square provides)
        const costAmount = defaultVariation?.costMoney?.amount || 0;
        const costExGst = costAmount / 100;
        
        // Calculate markup if we have both
        const markup = costExGst > 0 && sellExGst > 0 ? sellExGst / costExGst : 0;
        
        // Get vendor
        const dbVendorId = catalogItem.vendorId ? vendorMap.get(catalogItem.vendorId) : undefined;
        
        // Try to find existing item by Square catalog ID first, then by name
        let existingItem = await prisma.item.findFirst({
          where: { squareCatalogId },
        });
        
        if (!existingItem) {
          // Fall back to name matching for legacy items
          existingItem = await prisma.item.findFirst({
            where: { name: { equals: catalogItem.name, mode: 'insensitive' } },
          });
        }

        if (existingItem) {
          // Update existing item with Square data
          const updateData: any = {
            squareCatalogId, // Always set the Square ID
            squareVariationId,
          };
          let updateActions: string[] = ['square_ids'];

          // Update sell price from Square
          if (sellIncGst > 0) {
            updateData.currentSellIncGst = sellIncGst;
            updateData.currentSellExGst = sellExGst;
            updateActions.push('sell_price');
          }

          // Update cost from Square (store exactly what Square says)
          if (costExGst > 0) {
            updateData.currentCostExGst = costExGst;
            updateData.currentMarkup = markup;
            updateActions.push('cost');
          }

          // Update SKU if available
          if (defaultVariation?.sku && !existingItem.sku) {
            updateData.sku = defaultVariation.sku;
            updateActions.push('sku');
          }

          // Update vendor if we have one
          if (dbVendorId) {
            updateData.vendorId = dbVendorId;
            updateActions.push('vendor');
          }

          await prisma.item.update({
            where: { id: existingItem.id },
            data: updateData,
          });
          
          updated++;
          updatedItems.push({ 
            name: catalogItem.name, 
            squareId: squareCatalogId,
            action: updateActions.join('+'),
            sellIncGst,
            costExGst: costExGst > 0 ? costExGst : undefined,
          });
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
              vendorId: dbVendorId || undefined,
            },
          });
          
          created++;
          createdItems.push({
            name: catalogItem.name,
            squareId: squareCatalogId,
            sellIncGst,
            costExGst: costExGst > 0 ? costExGst : undefined,
            category: catalogItem.category?.name,
          });
        }
      } catch (err: any) {
        errors++;
        errorItems.push({ name: catalogItem.name, error: err.message });
        console.error(`❌ Error syncing ${catalogItem.name}:`, err.message);
      }
    }

    const result = {
      summary: {
        total: catalogItems.length,
        created,
        updated,
        skipped,
        errors,
        vendorsCreated,
        vendorsExisting,
      },
      details: {
        created: createdItems.slice(0, 50),
        updated: updatedItems.slice(0, 50),
        skipped: skippedItems.slice(0, 20),
        errors: errorItems,
      },
      tookMs: Date.now() - startTime,
    };

    console.log(`✅ Catalog sync complete: ${created} created, ${updated} updated, ${errors} errors`);
    return createSuccessResponse(result);
  } catch (error: any) {
    console.error('❌ Catalog sync failed:', error);
    return createErrorResponse('SYNC_ERROR', error.message, 500);
  }
}

export async function GET() {
  // GET triggers a sync
  return POST(new Request('http://localhost') as NextRequest);
}

export const dynamic = 'force-dynamic';
