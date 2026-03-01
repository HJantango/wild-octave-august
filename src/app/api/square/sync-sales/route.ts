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
async function fetchItemCatalogMap(client: SquareClient): Promise<Map<string, { categoryId?: string; itemName?: string; parentItemId?: string }>> {
  const itemMap = new Map<string, { categoryId?: string; itemName?: string; parentItemId?: string }>();
  try {
    const response: any = await client.catalog.list({ types: 'ITEM' });
    const objects = response.result?.objects || response.objects || [];
    const processItem = (obj: any) => {
      const itemData = obj.itemData;
      if (itemData?.variations) {
        for (const variation of itemData.variations) {
          if (variation.id) {
            // KEY FIX: Map variation ID → parent item ID
            itemMap.set(variation.id, {
              categoryId: itemData.categoryId || undefined,
              itemName: itemData.name || undefined,
              parentItemId: obj.id, // This is the parent catalog item ID
            });
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

        // Resolve category from catalog & get parent item ID
        let category: string | null = null;
        let parentCatalogId: string | null = catalogObjectId; // Default fallback
        
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

    // Upsert all records
    let upsertedCount = 0;
    const batchSize = 50;
    const entries = Array.from(aggregated.values());

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(
        batch.map((entry) => {
          // SQUARE-FIRST PRINCIPLE: Use Square catalog ID for vendor lookup, fall back to name
          const vendorName = entry.squareCatalogId 
            ? vendorLookupBySquareId.get(entry.squareCatalogId) || vendorLookupByName.get(entry.itemName.toLowerCase().trim())
            : vendorLookupByName.get(entry.itemName.toLowerCase().trim()) || null;
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
              vendorName,
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
              vendorName,
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
