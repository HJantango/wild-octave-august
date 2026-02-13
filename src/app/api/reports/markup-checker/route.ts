import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Category markup setting keys mapped to category names
// These match the Square reporting categories to our settings keys
const CATEGORY_MARKUP_MAP: Record<string, string> = {
  'House': 'markup_house',
  'Bulk': 'markup_bulk',
  'Fruit & Veg': 'markup_fruit_veg',
  'Fruit and Veg': 'markup_fruit_veg',
  'Fridge & Freezer': 'markup_fridge_freezer',
  'Fridge and Freezer': 'markup_fridge_freezer',
  'Naturo': 'markup_naturo',
  'Groceries': 'markup_groceries',
  'Drinks Fridge': 'markup_drinks_fridge',
  'Supplements': 'markup_supplements',
  'Personal Care': 'markup_personal_care',
  'Fresh Bread': 'markup_fresh_bread',
};

// Default markups if not in settings
const DEFAULT_MARKUPS: Record<string, number> = {
  'markup_house': 1.65,
  'markup_bulk': 1.75,
  'markup_fruit_veg': 1.75,
  'markup_fridge_freezer': 1.5,
  'markup_naturo': 1.65,
  'markup_groceries': 1.65,
  'markup_drinks_fridge': 1.65,
  'markup_supplements': 1.65,
  'markup_personal_care': 1.65,
  'markup_fresh_bread': 1.5,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category') || null;
    const shelfLabel = searchParams.get('shelfLabel') || null;
    const tolerance = parseFloat(searchParams.get('tolerance') || '0.05'); // 5% tolerance

    // Fetch category markup settings from database
    const markupSettings = await prisma.settings.findMany({
      where: {
        key: { startsWith: 'markup_' },
      },
    });

    // Build markup lookup from settings
    const categoryMarkups: Record<string, number> = { ...DEFAULT_MARKUPS };
    for (const setting of markupSettings) {
      if (setting.value && typeof setting.value === 'number') {
        categoryMarkups[setting.key] = setting.value;
      } else if (setting.value && typeof setting.value === 'object' && 'value' in (setting.value as any)) {
        categoryMarkups[setting.key] = (setting.value as any).value;
      }
    }

    console.log('📊 Category markups loaded:', categoryMarkups);

    // Build where clause
    const where: any = {};
    if (category && category !== 'all') {
      where.category = category;
    }
    if (shelfLabel && shelfLabel !== 'all') {
      where.subcategory = shelfLabel;
    }

    // Fetch items
    const items = await prisma.item.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ category: 'asc' }, { subcategory: 'asc' }, { name: 'asc' }],
    });

    // Get all unique categories and shelf labels for filters
    const allItems = await prisma.item.findMany({
      select: { category: true, subcategory: true },
      distinct: ['category', 'subcategory'],
    });

    const categories = [...new Set(allItems.map((i) => i.category))].filter(Boolean).sort();
    const shelfLabels = [...new Set(allItems.map((i) => i.subcategory).filter(Boolean))].sort() as string[];

    // Process items with markup analysis
    const processedItems = items
      .filter((item) => Number(item.currentCostExGst) > 0) // Only items with cost
      .map((item) => {
        const cost = Number(item.currentCostExGst);
        const actualMarkup = Number(item.currentMarkup);
        const actualSellExGst = Number(item.currentSellExGst);
        const actualSellIncGst = Number(item.currentSellIncGst);
        
        // Determine if item has GST by checking if inc/ex prices differ by ~10%
        const gstRatio = actualSellExGst > 0 ? actualSellIncGst / actualSellExGst : 1;
        const hasGst = gstRatio >= 1.08 && gstRatio <= 1.12; // Allow small tolerance
        
        // Get target markup for this category
        const settingKey = CATEGORY_MARKUP_MAP[item.category] || 'markup_groceries';
        const targetMarkup = categoryMarkups[settingKey] || 1.65;
        
        // Calculate what price SHOULD be at target markup
        const expectedSellExGst = cost * targetMarkup;
        const expectedSellIncGst = hasGst ? expectedSellExGst * 1.1 : expectedSellExGst; // Only add GST if item has GST
        
        // Markup difference
        const markupDiff = actualMarkup - targetMarkup;
        const isOnTarget = Math.abs(markupDiff) <= tolerance;
        const isUnder = markupDiff < -tolerance;
        const isOver = markupDiff > tolerance;
        
        // Price difference
        const priceDiffExGst = actualSellExGst - expectedSellExGst;
        const priceDiffIncGst = actualSellIncGst - expectedSellIncGst;

        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          shelfLabel: item.subcategory || 'Uncategorized',
          vendorName: item.vendor?.name || 'No Vendor',
          cost,
          targetMarkup,
          actualMarkup,
          actualSellExGst,
          actualSellIncGst,
          expectedSellExGst: Math.round(expectedSellExGst * 100) / 100,
          expectedSellIncGst: Math.round(expectedSellIncGst * 100) / 100,
          markupDiff: Math.round(markupDiff * 1000) / 1000,
          priceDiffExGst: Math.round(priceDiffExGst * 100) / 100,
          priceDiffIncGst: Math.round(priceDiffIncGst * 100) / 100,
          hasGst,
          status: isOnTarget ? 'on-target' : isUnder ? 'under' : 'over',
        };
      });

    // Summary stats
    const total = processedItems.length;
    const onTarget = processedItems.filter((i) => i.status === 'on-target').length;
    const under = processedItems.filter((i) => i.status === 'under').length;
    const over = processedItems.filter((i) => i.status === 'over').length;
    const withGst = processedItems.filter((i) => i.hasGst).length;
    const withoutGst = processedItems.filter((i) => !i.hasGst).length;

    // Sort: under-priced first (need attention), then over, then on-target
    const sortedItems = [...processedItems].sort((a, b) => {
      const statusOrder = { under: 0, over: 1, 'on-target': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort by markup diff magnitude
      return Math.abs(b.markupDiff) - Math.abs(a.markupDiff);
    });

    // Build readable category markups for UI
    const categoryMarkupsDisplay = Object.entries(CATEGORY_MARKUP_MAP).reduce((acc, [catName, settingKey]) => {
      acc[catName] = categoryMarkups[settingKey] || 1.65;
      return acc;
    }, {} as Record<string, number>);

    return createSuccessResponse({
      summary: {
        totalItems: total,
        onTarget,
        under,
        over,
        withGst,
        withoutGst,
        tolerance,
      },
      categoryMarkups: categoryMarkupsDisplay,
      categories,
      shelfLabels,
      items: sortedItems,
    });
  } catch (error) {
    console.error('Markup checker error:', error);
    return createErrorResponse('MARKUP_CHECKER_ERROR', 'Failed to analyze markups', 500);
  }
}
