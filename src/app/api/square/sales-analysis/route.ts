import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { Prisma } from '@prisma/client';

interface WeeklySalesData {
  itemId?: string;
  itemName: string;
  variationName?: string;
  vendorName: string;
  category: string;
  subcategory?: string;
  sku?: string;
  weeks: number[];
  totalUnits: number;
  avgWeekly: number;
  sellPrice: number;
  costPrice?: number;
  margin?: number;
  marginPercent?: number;
  currentStock?: number;
  suggestedOrder: number;
  wastageQty?: number;
  wastageCost?: number;
  discountQty?: number;
  discountAmount?: number;
}

// Get the Monday-based week number for a date
function getWeekKey(date: Date): string {
  const d = new Date(date);
  // Shift to Monday-start: Sunday becomes part of previous week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const vendorFilter = searchParams.get('vendorId') || searchParams.get('vendor') || null;
    const weeks = parseInt(searchParams.get('weeks') || '6');
    const orderFrequency = parseInt(searchParams.get('orderFrequency') || '1');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Build where clause
    const where: Prisma.SquareDailySalesWhereInput = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // If vendorFilter is provided, resolve vendor name
    if (vendorFilter) {
      // Could be vendor ID or vendor name
      const vendor = await prisma.vendor.findFirst({
        where: {
          OR: [
            { id: vendorFilter },
            { name: { contains: vendorFilter, mode: 'insensitive' } },
          ],
        },
      });
      if (vendor) {
        where.vendorName = vendor.name;
      } else {
        // Try direct name match on sales data
        where.vendorName = { contains: vendorFilter, mode: 'insensitive' };
      }
    }

    // Fetch all daily sales records
    const dailySales = await prisma.squareDailySales.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (dailySales.length === 0) {
      return createSuccessResponse({
        items: [],
        summary: {
          totalItems: 0,
          weeksAnalyzed: weeks,
          orderFrequency,
          totalSuggestedUnits: 0,
          source: 'square_sync',
          lastSyncDate: null,
        },
      });
    }

    // Determine week boundaries from the data
    const weekKeys = new Set<string>();
    for (const record of dailySales) {
      weekKeys.add(getWeekKey(new Date(record.date)));
    }
    const sortedWeeks = Array.from(weekKeys).sort();
    const weekIndexMap = new Map<string, number>();
    sortedWeeks.forEach((wk, idx) => weekIndexMap.set(wk, idx));
    const numWeeks = sortedWeeks.length;

    // Aggregate by item+variation across weeks
    const itemMap = new Map<string, {
      itemName: string;
      variationName: string | null;
      category: string | null;
      vendorName: string | null;
      squareCatalogId: string | null;
      weeks: number[];
      totalUnits: number;
      totalGrossCents: number;
    }>();

    for (const record of dailySales) {
      const key = `${record.itemName}|${record.variationName || ''}`;
      const weekKey = getWeekKey(new Date(record.date));
      const weekIdx = weekIndexMap.get(weekKey) ?? 0;

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemName: record.itemName,
          variationName: record.variationName,
          category: record.category,
          vendorName: record.vendorName,
          squareCatalogId: record.squareCatalogId,
          weeks: new Array(numWeeks).fill(0),
          totalUnits: 0,
          totalGrossCents: 0,
        });
      }

      const data = itemMap.get(key)!;
      const qty = Number(record.quantitySold);
      data.weeks[weekIdx] += qty;
      data.totalUnits += qty;
      data.totalGrossCents += record.grossSalesCents;
      // Fill in any missing metadata
      if (!data.category && record.category) data.category = record.category;
      if (!data.vendorName && record.vendorName) data.vendorName = record.vendorName;
      if (!data.squareCatalogId && record.squareCatalogId) data.squareCatalogId = record.squareCatalogId;
    }

    // Fetch database items for enrichment (pricing, stock, vendor)
    const dbItems = await prisma.item.findMany({
      include: {
        vendor: { select: { name: true } },
        inventoryItem: { select: { currentStock: true } },
      },
    });

    // SQUARE-FIRST PRINCIPLE: Use Square catalog IDs for accurate matching
    const dbItemsBySquareId = new Map(
      dbItems.filter(i => i.squareCatalogId).map(item => [item.squareCatalogId!, item])
    );
    const dbItemsByName = new Map(
      dbItems.map(item => [item.name.toLowerCase().trim(), item])
    );
    const dbItemsBySku = new Map(
      dbItems.filter(i => i.sku).map(item => [item.sku!.toLowerCase().trim(), item])
    );

    // Fetch wastage and discount data for the period
    const [wastageRecords, discountRecords] = await Promise.all([
      prisma.wastageRecord.findMany({
        where: { adjustmentDate: { gte: startDate, lte: endDate } },
      }),
      prisma.discountRecord.findMany({
        where: { saleDate: { gte: startDate, lte: endDate } },
      }),
    ]);

    const wastageByItem = new Map<string, { qty: number; cost: number }>();
    for (const wr of wastageRecords) {
      const id = wr.itemId || `name:${wr.itemName}`;
      const wd = wastageByItem.get(id) || { qty: 0, cost: 0 };
      wd.qty += Number(wr.quantity);
      wd.cost += Number(wr.totalCost);
      wastageByItem.set(id, wd);
    }

    const discountsByItem = new Map<string, { qty: number; amount: number }>();
    for (const dr of discountRecords) {
      const id = dr.itemId || `name:${dr.itemName}`;
      const dd = discountsByItem.get(id) || { qty: 0, amount: 0 };
      dd.qty += Number(dr.quantity);
      dd.amount += Number(dr.discountAmount);
      discountsByItem.set(id, dd);
    }

    // Build results matching the CSV analyze-sales output format
    const results: WeeklySalesData[] = [];

    const itemEntries = Array.from(itemMap.values());
    for (const data of itemEntries) {
      const avgWeekly = data.totalUnits / weeks; // Use requested weeks, not data weeks
      const avgSellPrice = data.totalUnits > 0
        ? (data.totalGrossCents / 100) / data.totalUnits
        : 0;

      // SQUARE-FIRST PRINCIPLE: Match by Square catalog ID first, fall back to name
      const dbItem = data.squareCatalogId 
        ? dbItemsBySquareId.get(data.squareCatalogId) || dbItemsByName.get(data.itemName.toLowerCase().trim())
        : dbItemsByName.get(data.itemName.toLowerCase().trim());

      const currentStock = dbItem?.inventoryItem?.currentStock
        ? Number(dbItem.inventoryItem.currentStock)
        : 0;

      const suggestedOrder = Math.max(
        0,
        Math.ceil(avgWeekly * orderFrequency) - currentStock
      );

      let costPrice: number | undefined;
      let margin: number | undefined;
      let marginPercent: number | undefined;
      let sellPrice = avgSellPrice;

      if (dbItem) {
        costPrice = Number(dbItem.currentCostExGst);
        const sellExGst = Number(dbItem.currentSellExGst);
        sellPrice = Number(dbItem.currentSellIncGst);
        if (costPrice && sellExGst) {
          margin = sellExGst - costPrice;
          marginPercent = (margin / sellExGst) * 100;
        }
      }

      const entry: WeeklySalesData = {
        itemId: dbItem?.id,
        itemName: data.itemName,
        variationName: data.variationName || undefined,
        vendorName: data.vendorName || dbItem?.vendor?.name || 'Unknown',
        category: data.category || dbItem?.category || 'Uncategorized',
        subcategory: dbItem?.subcategory || undefined,
        sku: dbItem?.sku || undefined,
        weeks: data.weeks.map(w => parseFloat(w.toFixed(1))),
        totalUnits: parseFloat(data.totalUnits.toFixed(1)),
        avgWeekly: parseFloat(avgWeekly.toFixed(1)),
        sellPrice: parseFloat(sellPrice.toFixed(2)),
        costPrice: costPrice ? parseFloat(costPrice.toFixed(4)) : undefined,
        margin: margin ? parseFloat(margin.toFixed(4)) : undefined,
        marginPercent: marginPercent ? parseFloat(marginPercent.toFixed(1)) : undefined,
        currentStock,
        suggestedOrder,
      };

      // Enrich with wastage/discount
      if (dbItem?.id) {
        const w = wastageByItem.get(dbItem.id);
        if (w) {
          entry.wastageQty = parseFloat(w.qty.toFixed(2));
          entry.wastageCost = parseFloat(w.cost.toFixed(2));
        }
        const d = discountsByItem.get(dbItem.id);
        if (d) {
          entry.discountQty = parseFloat(d.qty.toFixed(2));
          entry.discountAmount = parseFloat(d.amount.toFixed(2));
        }
      }

      results.push(entry);
    }

    // Sort by category, then by average weekly sales descending
    results.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return b.avgWeekly - a.avgWeekly;
    });

    // Get last sync timestamp
    const lastSync = await prisma.squareDailySales.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return createSuccessResponse({
      items: results,
      summary: {
        totalItems: results.length,
        weeksAnalyzed: weeks,
        weekColumns: sortedWeeks,
        orderFrequency,
        totalSuggestedUnits: results.reduce((sum, i) => sum + i.suggestedOrder, 0),
        source: 'square_sync',
        lastSyncDate: lastSync?.updatedAt || null,
      },
    });
  } catch (error: any) {
    console.error('❌ Sales analysis error:', error);
    return createErrorResponse(
      'ANALYSIS_ERROR',
      `Failed to analyze sales data: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
