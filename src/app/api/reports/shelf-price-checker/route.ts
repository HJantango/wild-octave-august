import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface ShelfItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
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

    console.log('📋 Fetching shelf price checker data from local database...');

    // Fetch items from local database (synced from Square)
    const items = await prisma.item.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    console.log(`📦 Fetched ${items.length} items from database`);

    // Transform to ShelfItem format
    const allItems: ShelfItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku || null,
      barcode: item.barcode || null,
      price: Number(item.currentSellIncGst), // Use selling price inc GST
      categoryName: item.category || 'Uncategorized',
    }));

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
