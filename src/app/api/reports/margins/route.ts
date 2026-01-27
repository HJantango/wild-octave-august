import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch all items with vendor info
    const items = await prisma.item.findMany({
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate margin data for each item
    const itemMargins = items.map((item) => {
      const cost = Number(item.currentCostExGst) || 0;
      const sell = Number(item.currentSellExGst) || 0;
      const markup = Number(item.currentMarkup) || 0;
      const grossProfit = sell - cost;
      const marginPercent = sell > 0 ? (grossProfit / sell) * 100 : 0;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        vendorId: item.vendorId,
        vendorName: item.vendor?.name || 'No Vendor',
        cost,
        sell,
        markup: markup * 100, // convert to percentage
        grossProfit,
        marginPercent,
      };
    });

    // Filter out items with zero prices (not properly set up)
    const validItems = itemMargins.filter((i) => i.sell > 0 && i.cost > 0);

    // Group by category
    const categoryMap = new Map<string, { items: typeof validItems; totalCost: number; totalSell: number }>();
    for (const item of validItems) {
      const existing = categoryMap.get(item.category) || { items: [], totalCost: 0, totalSell: 0 };
      existing.items.push(item);
      existing.totalCost += item.cost;
      existing.totalSell += item.sell;
      categoryMap.set(item.category, existing);
    }

    const categoryMargins = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const avgMargin = data.items.reduce((sum, i) => sum + i.marginPercent, 0) / data.items.length;
        const avgMarkup = data.items.reduce((sum, i) => sum + i.markup, 0) / data.items.length;
        return {
          category,
          itemCount: data.items.length,
          avgMarginPercent: Math.round(avgMargin * 10) / 10,
          avgMarkup: Math.round(avgMarkup * 10) / 10,
          totalCost: Math.round(data.totalCost * 100) / 100,
          totalSell: Math.round(data.totalSell * 100) / 100,
        };
      })
      .sort((a, b) => a.avgMarginPercent - b.avgMarginPercent);

    // Group by vendor
    const vendorMap = new Map<string, { vendorName: string; items: typeof validItems }>();
    for (const item of validItems) {
      const key = item.vendorId || 'no-vendor';
      const existing = vendorMap.get(key) || { vendorName: item.vendorName, items: [] };
      existing.items.push(item);
      vendorMap.set(key, existing);
    }

    const vendorMargins = Array.from(vendorMap.entries())
      .map(([vendorId, data]) => {
        const avgMargin = data.items.reduce((sum, i) => sum + i.marginPercent, 0) / data.items.length;
        const avgMarkup = data.items.reduce((sum, i) => sum + i.markup, 0) / data.items.length;
        return {
          vendorId,
          vendorName: data.vendorName,
          itemCount: data.items.length,
          avgMarginPercent: Math.round(avgMargin * 10) / 10,
          avgMarkup: Math.round(avgMarkup * 10) / 10,
        };
      })
      .sort((a, b) => a.avgMarginPercent - b.avgMarginPercent);

    // Lowest margin items (candidates for price increase)
    const lowestMarginItems = [...validItems]
      .sort((a, b) => a.marginPercent - b.marginPercent)
      .slice(0, 20);

    // Highest margin items (performing well)
    const highestMarginItems = [...validItems]
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 20);

    // Overall summary
    const overallAvgMargin = validItems.reduce((sum, i) => sum + i.marginPercent, 0) / (validItems.length || 1);
    const overallAvgMarkup = validItems.reduce((sum, i) => sum + i.markup, 0) / (validItems.length || 1);

    return createSuccessResponse({
      summary: {
        totalItems: items.length,
        itemsWithPricing: validItems.length,
        overallAvgMargin: Math.round(overallAvgMargin * 10) / 10,
        overallAvgMarkup: Math.round(overallAvgMarkup * 10) / 10,
      },
      categoryMargins,
      vendorMargins,
      lowestMarginItems,
      highestMarginItems,
    });
  } catch (error) {
    console.error('Margins report error:', error);
    return createErrorResponse('MARGINS_ERROR', 'Failed to generate margin report', 500);
  }
}
