import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

interface ShelfItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  categoryName: string;
}

interface ShelfGroup {
  shelfLabel: string;
  items: ShelfItem[];
  itemCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const shelfFilter = searchParams.get('shelf') || 'all';

    console.log('📋 Fetching shelf price checker data...');

    const client = getSquareClient();

    // Fetch categories first
    const categoryMap = new Map<string, string>();
    try {
      const catResponse: any = await client.catalog.list({ types: 'CATEGORY' });
      const catObjects = catResponse.result?.objects || catResponse.objects || [];
      for (const obj of catObjects) {
        if (obj.id && obj.categoryData?.name) {
          categoryMap.set(obj.id, obj.categoryData.name);
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch categories:', err);
    }

    // Fetch all items from catalog
    const allItems: ShelfItem[] = [];
    let cursor: string | undefined;

    do {
      const response: any = await client.catalog.list({
        types: 'ITEM',
        ...(cursor && { cursor }),
      });

      const objects = response.result?.objects || response.objects || [];

      for (const obj of objects) {
        if (!obj.itemData) continue;

        const categoryId = obj.itemData.categoryId;
        const categoryName = categoryId ? categoryMap.get(categoryId) || 'Uncategorized' : 'Uncategorized';

        // Get first variation's price
        const variations = obj.itemData.variations || [];
        const firstVariation = variations[0];
        const priceMoney = firstVariation?.itemVariationData?.priceMoney;
        const price = priceMoney ? Number(priceMoney.amount) / 100 : 0;

        // Get SKU from first variation
        const sku = firstVariation?.itemVariationData?.sku || null;

        allItems.push({
          id: obj.id,
          name: obj.itemData.name || 'Unknown Item',
          sku,
          price,
          categoryName,
        });
      }

      cursor = response.result?.cursor || response.cursor;
    } while (cursor);

    console.log(`📦 Fetched ${allItems.length} items from catalog`);

    // Get unique categories (shelf labels)
    const uniqueCategories = [...new Set(allItems.map(i => i.categoryName))].sort();

    // Filter by shelf if specified
    const filteredItems = shelfFilter === 'all'
      ? allItems
      : allItems.filter(i => i.categoryName === shelfFilter);

    // Group items by category
    const shelfGroups: ShelfGroup[] = [];
    const groupMap = new Map<string, ShelfItem[]>();

    for (const item of filteredItems) {
      if (!groupMap.has(item.categoryName)) {
        groupMap.set(item.categoryName, []);
      }
      groupMap.get(item.categoryName)!.push(item);
    }

    // Sort items within each group by name
    for (const [shelfLabel, items] of groupMap.entries()) {
      items.sort((a, b) => a.name.localeCompare(b.name));
      shelfGroups.push({
        shelfLabel,
        items,
        itemCount: items.length,
      });
    }

    // Sort groups by name
    shelfGroups.sort((a, b) => a.shelfLabel.localeCompare(b.shelfLabel));

    return createSuccessResponse({
      shelfGroups,
      availableShelves: uniqueCategories,
      totalItems: filteredItems.length,
      selectedShelf: shelfFilter,
    });
  } catch (error: any) {
    console.error('❌ Shelf price checker error:', error);
    return createErrorResponse('SHELF_PRICE_CHECKER_ERROR', error.message, 500);
  }
}
