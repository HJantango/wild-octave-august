import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const LOCATION_ID = 'LXREF1GKT3ZMF';
const MAX_ORDERS_PER_PAGE = 500;
const MAX_PAGES = 100; // Safety limit

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

// Fetch category names from Square catalog for enrichment
async function fetchCategoryMap(client: SquareClient): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();
  try {
    const response: any = await client.catalog.list({ types: 'CATEGORY' });
    const objects = response.result?.objects || response.objects || [];
    for (const obj of objects) {
      if (obj.id && obj.categoryData?.name) {
        categoryMap.set(obj.id, obj.categoryData.name);
      }
    }
    // Also handle async iterator pattern from newer SDK
    if (objects.length === 0 && response[Symbol.asyncIterator]) {
      for await (const obj of response) {
        if (obj.id && obj.categoryData?.name) {
          categoryMap.set(obj.id, obj.categoryData.name);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not fetch categories from Square catalog:', err);
  }
  return categoryMap;
}

// Fetch item catalog data (category, vendor) for enrichment
// CRITICAL: Build variation ID → parent item ID mapping to fix Square ID mismatch
async function fetchItemCatalogMap(client: SquareClient): Promise<Map<string, { categoryId?: string; itemName?: string; parentItemId?: string; vendorId?: string; vendorName?: string }>> {
  const itemMap = new Map<string, { categoryId?: string; itemName?: string; parentItemId?: string; vendorId?: string; vendorName?: string }>();
  
  // First get all vendors to build vendor ID → name mapping
  const vendorMap = new Map<string, string>();
  try {
    const vendorsResponse: any = await client.catalog.list({ types: 'VENDOR' });
    const vendors = vendorsResponse.result?.objects || vendorsResponse.objects || [];
    for (const vendor of vendors) {
      if (vendor.id && vendor.vendorData?.name) {
        vendorMap.set(vendor.id, vendor.vendorData.name);
      }
    }
    console.log(`📦 Found ${vendorMap.size} vendors in Square catalog`);
  } catch (err) {
    console.warn('⚠️  Could not fetch vendors from Square catalog:', err);
  }
  
  try {
    const response: any = await client.catalog.list({ types: 'ITEM' });
    const objects = response.result?.objects || response.objects || [];
    const processItem = (obj: any) => {
      const itemData = obj.itemData;
      if (itemData?.variations) {
        for (const variation of itemData.variations) {
          if (variation.id) {
            // Extract vendor info from variation data
            const variationData = variation.itemVariationData;
            const vendorInfos = variationData?.itemVariationVendorInfos || [];
            const vendorId = vendorInfos[0]?.vendorId;
            const vendorName = vendorId ? vendorMap.get(vendorId) : undefined;
            
            // KEY FIX: Map variation ID → parent item ID + vendor info
            itemMap.set(variation.id, {
              categoryId: itemData.categoryId || undefined,
              itemName: itemData.name || undefined,
              parentItemId: obj.id, // This is the parent catalog item ID
              vendorId: vendorId || undefined,
              vendorName: vendorName || undefined,
            });
            
            if (vendorName && vendorName.toLowerCase().includes('heaps good')) {
              console.log(`✅ Found Heaps Good item: "${itemData.name}" → vendor: ${vendorName}`);
            }
          }
        }
      }
    };
    for (const obj of objects) {
      processItem(obj);
    }
    // Handle async iterator pattern
    if (objects.length === 0 && response[Symbol.asyncIterator]) {
      for await (const obj of response) {
        processItem(obj);
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not fetch item catalog from Square:', err);
  }
  return itemMap;
}

// Fetch all completed orders with proper pagination
async function fetchAllOrders(
  client: SquareClient,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const allOrders: any[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    pageCount++;
    console.log(`📄 Fetching orders page ${pageCount}...`);

    const requestBody: any = {
      locationIds: [LOCATION_ID],
      query: {
        filter: {
          stateFilter: {
            states: ['COMPLETED'],
          },
          dateTimeFilter: {
            createdAt: {
              startAt: startDate.toISOString(),
              endAt: endDate.toISOString(),
            },
          },
        },
        sort: {
          sortField: 'CREATED_AT',
          sortOrder: 'DESC',
        },
      },
      limit: MAX_ORDERS_PER_PAGE,
      ...(cursor && { cursor }),
    };

    const response: any = await client.orders.search(requestBody);
    const orders = response.result?.orders || response.orders || [];
    allOrders.push(...orders);

    cursor = response.result?.cursor || response.cursor || undefined;
    console.log(`  → Got ${orders.length} orders (total: ${allOrders.length})${cursor ? ', more pages available' : ''}`);
  } while (cursor && pageCount < MAX_PAGES);

  return allOrders;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const endDate = new Date();
    // ALWAYS sync all sales since shop opened (March 22, 2025) - no more weeks limitation
    const startDate = new Date('2025-03-22');

    console.log(`🔄 Syncing ALL Square sales from shop opening (${startDate.toISOString().split('T')[0]}) to ${endDate.toISOString().split('T')[0]}`);

    const client = getSquareClient();

    // Fetch catalog data for enrichment (parallel)
    const [categoryMap, itemCatalogMap, orders] = await Promise.all([
      fetchCategoryMap(client),
      fetchItemCatalogMap(client),
      fetchAllOrders(client, startDate, endDate),
    ]);

    console.log(`📦 Fetched ${orders.length} completed orders`);
    console.log(`📚 Loaded ${categoryMap.size} categories, ${itemCatalogMap.size} catalog items`);

    // Aggregate line items by item+variation+day
    // Key: "date|itemName|variationName"
    const aggregated = new Map<string, {
      date: Date;
      itemName: string;
      variationName: string | null;
      category: string | null;
      quantitySold: number;
      grossSalesCents: number;
      netSalesCents: number;
      squareCatalogId: string | null;
      vendorName: string | null;
    }>();

    let lineItemCount = 0;

    for (const order of orders) {
      if (!order.lineItems) continue;

      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD

      for (const item of order.lineItems) {
        lineItemCount++;
        const itemName = item.name || 'Unknown Item';
        const variationName = item.variationName || null;
        const catalogObjectId = item.catalogObjectId || null;

        // Resolve category, vendor, and parent item ID from catalog
        let category: string | null = null;
        let parentCatalogId: string | null = catalogObjectId; // Default fallback
        let vendorName: string | null = null;
        
        if (catalogObjectId) {
          const catalogItem = itemCatalogMap.get(catalogObjectId);
          if (catalogItem) {
            if (catalogItem.categoryId) {
              category = categoryMap.get(catalogItem.categoryId) || null;
            }
            // CRITICAL FIX: Use parent item ID instead of variation ID
            if (catalogItem.parentItemId) {
              parentCatalogId = catalogItem.parentItemId;
              console.log(`🔄 Variation ${catalogObjectId} → Parent ${parentCatalogId} for "${itemName}"`);
            }
            // EXTRACT VENDOR FROM SQUARE CATALOG
            if (catalogItem.vendorName) {
              vendorName = catalogItem.vendorName;
              console.log(`🏪 Found vendor "${vendorName}" for "${itemName}" from Square catalog`);
            }
          }
        }

        const quantity = parseFloat(item.quantity || '0');
        const grossCents = Number(item.totalMoney?.amount || 0);
        const taxCents = Number(item.totalTaxMoney?.amount || 0);
        const netCents = grossCents - taxCents;

        const key = `${dateStr}|${itemName}|${variationName || ''}`;

        if (aggregated.has(key)) {
          const existing = aggregated.get(key)!;
          existing.quantitySold += quantity;
          existing.grossSalesCents += grossCents;
          existing.netSalesCents += netCents;
          // Keep first parent catalog ID found (FIXED)
          if (!existing.squareCatalogId && parentCatalogId) {
            existing.squareCatalogId = parentCatalogId;
          }
          if (!existing.category && category) {
            existing.category = category;
          }
          // VENDOR FROM SQUARE: Keep first vendor found
          if (!existing.vendorName && vendorName) {
            existing.vendorName = vendorName;
          }
        } else {
          aggregated.set(key, {
            date: new Date(dateStr + 'T00:00:00.000Z'),
            itemName,
            variationName,
            category,
            quantitySold: quantity,
            grossSalesCents: grossCents,
            netSalesCents: netCents,
            squareCatalogId: parentCatalogId, // FIXED: Use parent item ID
            vendorName: vendorName, // VENDOR FROM SQUARE CATALOG
          });
        }
      }
    }

    console.log(`📊 Aggregated ${lineItemCount} line items into ${aggregated.size} daily records`);

    // SQUARE-FIRST PRINCIPLE: Match vendors by Square catalog ID first, fall back to name
    const dbItems = await prisma.item.findMany({
      select: { 
        squareCatalogId: true, 
        name: true, 
        vendor: { select: { name: true } } 
      },
    });
    const vendorLookupBySquareId = new Map<string, string>();
    const vendorLookupByName = new Map<string, string>();
    for (const dbItem of dbItems) {
      if (dbItem.vendor?.name) {
        if (dbItem.squareCatalogId) {
          vendorLookupBySquareId.set(dbItem.squareCatalogId, dbItem.vendor.name);
        }
        vendorLookupByName.set(dbItem.name.toLowerCase().trim(), dbItem.vendor.name);
      }
    }

    // CAFE VENDOR PATTERNS - when Square and Item table lookups fail
    // Maps item name patterns to vendor names
    const CAFE_VENDOR_PATTERNS: Array<{ pattern: RegExp; vendor: string }> = [
      // Yummify patterns - savoury items
      { pattern: /protein patty/i, vendor: 'Yummify' },
      { pattern: /spinach.*pumpkin.*roll/i, vendor: 'Yummify' },
      { pattern: /vegan.*lasagne/i, vendor: 'Yummify' },
      { pattern: /lentil.*shepherd.*pie|lentil.*shepard.*pie/i, vendor: 'Yummify' },
      { pattern: /frittata.*sweet.*potato/i, vendor: 'Yummify' },
      // Yummify also has cakes - add these if Heath confirms which ones
      // { pattern: /yummify.*cake/i, vendor: 'Yummify' },
      
      // Gigi's patterns
      { pattern: /gigi'?s/i, vendor: "Gigi's" },
      
      // Byron Brownies
      { pattern: /byron.*brownie/i, vendor: 'Byron Brownies' },
      
      // Yumbar
      { pattern: /yumbar/i, vendor: 'Yumbar' },
    ];
    
    // Function to match vendor by pattern
    const getVendorByPattern = (itemName: string): string | null => {
      for (const { pattern, vendor } of CAFE_VENDOR_PATTERNS) {
        if (pattern.test(itemName)) {
          return vendor;
        }
      }
      return null;
    };

    // Upsert all records
    let upsertedCount = 0;
    const batchSize = 50;
    const entries = Array.from(aggregated.values());

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(
        batch.map((entry) => {
          // SQUARE-FIRST PRINCIPLE: Use vendor from Square catalog first, fall back to database lookup, then patterns
          const finalVendorName = entry.vendorName || // 1. Vendor from Square catalog
            (entry.squareCatalogId 
              ? vendorLookupBySquareId.get(entry.squareCatalogId) || vendorLookupByName.get(entry.itemName.toLowerCase().trim())
              : vendorLookupByName.get(entry.itemName.toLowerCase().trim())) || // 2. Database lookup
            getVendorByPattern(entry.itemName) || // 3. Pattern matching fallback
            null;
              
          if (entry.vendorName && entry.vendorName.toLowerCase().includes('heaps good')) {
            console.log(`🎉 HEAPS GOOD: Using vendor "${entry.vendorName}" from Square catalog for "${entry.itemName}"`);
          }
          
          return prisma.squareDailySales.upsert({
            where: {
              unique_daily_item_variation: {
                date: entry.date,
                itemName: entry.itemName,
                variationName: entry.variationName || '',
              },
            },
            update: {
              category: entry.category,
              vendorName: finalVendorName,
              quantitySold: entry.quantitySold,
              grossSalesCents: entry.grossSalesCents,
              netSalesCents: entry.netSalesCents,
              squareCatalogId: entry.squareCatalogId,
            },
            create: {
              date: entry.date,
              itemName: entry.itemName,
              variationName: entry.variationName || '',
              category: entry.category,
              vendorName: finalVendorName, // FIXED: Use vendor from Square catalog
              quantitySold: entry.quantitySold,
              grossSalesCents: entry.grossSalesCents,
              netSalesCents: entry.netSalesCents,
              squareCatalogId: entry.squareCatalogId,
            },
          });
        })
      );
      upsertedCount += batch.length;
    }

    console.log(`✅ Upserted ${upsertedCount} daily sales records`);

    // Build summary
    const uniqueItems = new Set(entries.map(e => e.itemName));
    const dateRange = {
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
    };
    const daysSinceOpening = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    return createSuccessResponse({
      summary: {
        ordersProcessed: orders.length,
        lineItemsProcessed: lineItemCount,
        dailyRecordsUpserted: upsertedCount,
        uniqueItems: uniqueItems.size,
        dateRange,
        daysSinceOpening,
      },
    }, `Synced ${upsertedCount} daily sales records from ${orders.length} orders (all-time since opening)`);
  } catch (error: any) {
    console.error('❌ Square sync error:', error);
    return createErrorResponse(
      'SYNC_ERROR',
      `Failed to sync Square sales: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for large syncs
