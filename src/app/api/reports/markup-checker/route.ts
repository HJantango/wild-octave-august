import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category') || null;
    const shelfLabel = searchParams.get('shelfLabel') || null;
    const targetMarkup = parseFloat(searchParams.get('targetMarkup') || '1.75');
    const tolerance = parseFloat(searchParams.get('tolerance') || '0.05'); // 5% tolerance

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
        
        // Calculate what price SHOULD be at target markup
        const expectedSellExGst = cost * targetMarkup;
        const expectedSellIncGst = expectedSellExGst * 1.1; // 10% GST
        
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
          actualMarkup,
          actualSellExGst,
          actualSellIncGst,
          expectedSellExGst: Math.round(expectedSellExGst * 100) / 100,
          expectedSellIncGst: Math.round(expectedSellIncGst * 100) / 100,
          markupDiff: Math.round(markupDiff * 1000) / 1000,
          priceDiffExGst: Math.round(priceDiffExGst * 100) / 100,
          priceDiffIncGst: Math.round(priceDiffIncGst * 100) / 100,
          status: isOnTarget ? 'on-target' : isUnder ? 'under' : 'over',
        };
      });

    // Summary stats
    const total = processedItems.length;
    const onTarget = processedItems.filter((i) => i.status === 'on-target').length;
    const under = processedItems.filter((i) => i.status === 'under').length;
    const over = processedItems.filter((i) => i.status === 'over').length;

    // Sort: under-priced first (need attention), then over, then on-target
    const sortedItems = [...processedItems].sort((a, b) => {
      const statusOrder = { under: 0, over: 1, 'on-target': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort by markup diff magnitude
      return Math.abs(b.markupDiff) - Math.abs(a.markupDiff);
    });

    return createSuccessResponse({
      summary: {
        totalItems: total,
        onTarget,
        under,
        over,
        targetMarkup,
        tolerance,
      },
      categories,
      shelfLabels,
      items: sortedItems,
    });
  } catch (error) {
    console.error('Markup checker error:', error);
    return createErrorResponse('MARKUP_CHECKER_ERROR', 'Failed to analyze markups', 500);
  }
}
