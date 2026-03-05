import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface ProductRationalizationItem {
  id: string;
  name: string;
  category: string;
  shelfLabel: string | null;
  vendorName: string | null;
  sku: string | null;
  costExGst: number;
  sellIncGst: number;
  marginPercent: number;
  totalUnitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  avgWeeklySales: number;
  avgWeeklyProfit: number;
  weeksWithSales: number;
  similarGroup?: string;
  decision?: 'keep' | 'remove' | 'staple' | null;
}

// Extract keywords for grouping similar products
function extractKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(' ')
    .filter(word => word.length > 3 && !['organic', 'natural', 'gluten', 'free'].includes(word))
    .slice(0, 3); // Limit to first 3 meaningful words
}

// Group similar products by shared keywords
function findSimilarGroups(items: { id: string; name: string }[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  const itemGroups = new Map<string, string>();

  // Common product type keywords for grouping
  const productTypes = [
    'toothpaste', 'shampoo', 'conditioner', 'soap', 'lotion', 'cream',
    'oil', 'butter', 'milk', 'yogurt', 'cheese', 'bread', 'pasta',
    'rice', 'flour', 'sugar', 'honey', 'chocolate', 'chips', 'crackers',
    'tea', 'coffee', 'juice', 'water', 'kombucha', 'supplement', 'vitamin',
    'protein', 'bar', 'cookie', 'biscuit', 'cereal', 'muesli', 'granola'
  ];

  for (const item of items) {
    const keywords = extractKeywords(item.name);
    
    // Find matching product type
    for (const type of productTypes) {
      if (item.name.toLowerCase().includes(type)) {
        if (!groups.has(type)) {
          groups.set(type, []);
        }
        groups.get(type)!.push(item.id);
        break;
      }
    }
  }

  // Only keep groups with 2+ items (actual duplicates/similar)
  for (const [groupName, itemIds] of groups.entries()) {
    if (itemIds.length >= 2) {
      for (const id of itemIds) {
        itemGroups.set(id, groupName);
      }
    }
  }

  return itemGroups;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const shelfLabel = searchParams.get('shelfLabel') || null;
    const category = searchParams.get('category') || null;

    // Calculate date range - ALWAYS start from when Square was installed (May 21, 2025)
    const endDate = new Date();
    const startDate = new Date('2025-05-21'); // Square POS installation date

    // Get all items with optional filtering
    const where: any = {};
    if (shelfLabel && shelfLabel !== 'all') {
      where.subcategory = shelfLabel;
    }
    if (category && category !== 'all') {
      where.category = category;
    }

    const items = await prisma.item.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get sales data from SquareDailySales - SQUARE CATALOG ID ONLY
    const salesData = await prisma.squareDailySales.groupBy({
      by: ['squareCatalogId'],
      where: {
        date: { gte: startDate, lte: endDate },
        squareCatalogId: { not: null }, // Only items with Square catalog IDs
      },
      _sum: {
        quantitySold: true,
        netSalesCents: true,
      },
      _count: {
        date: true,
      },
    });

    console.log(`📊 Found ${salesData.length} Square catalog IDs with sales data`);

    // Build sales lookup by Square catalog ID ONLY
    const salesLookup = new Map<string, { units: number; revenue: number; weeks: number }>();
    
    for (const sale of salesData) {
      if (!sale.squareCatalogId) continue;
      
      const units = Number(sale._sum.quantitySold) || 0;
      const revenue = (sale._sum.netSalesCents || 0) / 100;
      const weeks = sale._count.date || 0;
      
      salesLookup.set(sale.squareCatalogId, { units, revenue, weeks });
    }
    
    // Celtic salt aggregation disabled temporarily - using standard catalog ID matching only

    // Get existing decisions
    const decisions = await prisma.productDecision.findMany({
      select: { itemId: true, decision: true },
    }).catch(() => []); // Table might not exist yet

    const decisionLookup = new Map<string, string>();
    for (const d of decisions) {
      decisionLookup.set(d.itemId, d.decision);
    }

    // Find similar product groups
    const similarGroups = findSimilarGroups(items.map(i => ({ id: i.id, name: i.name })));

    // Calculate weeks since Square installation (May 21, 2025)
    const weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    let itemsWithSales = 0;
    let itemsWithoutSales = 0;
    let itemsWithoutSquareId = 0;

    // Build result using ONLY Square catalog ID matching
    const result: ProductRationalizationItem[] = items.map(item => {
      let sales = { units: 0, revenue: 0, weeks: 0 };
      
      if (item.squareCatalogId) {
        const saleData = salesLookup.get(item.squareCatalogId);
        if (saleData) {
          sales = saleData;
          itemsWithSales++;
          console.log(`✅ Square ID match: "${item.name}" → ${sales.units} units, $${sales.revenue.toFixed(2)}`);
        } else {
          itemsWithoutSales++;
        }
      } else {
        itemsWithoutSquareId++;
        console.log(`❌ No Square catalog ID for: "${item.name}"`);
      }
      
      const itemCost = Number(item.currentCostExGst) || 0;
      const itemSell = Number(item.currentSellIncGst) || 0;
      
      // Use actual sell price from sales data if available (more accurate than Item table)
      const actualSellFromSales = sales.units > 0 ? sales.revenue / sales.units : 0;
      const sell = actualSellFromSales > 0 ? actualSellFromSales : itemSell;
      const sellExGst = sell / 1.1;
      const profit = sellExGst - itemCost;
      const margin = sellExGst > 0 ? ((sellExGst - itemCost) / sellExGst) * 100 : 0;

      return {
        id: item.id,
        name: item.name,
        category: item.category || 'Uncategorized',
        shelfLabel: item.subcategory,
        vendorName: item.vendor?.name || null,
        sku: item.sku,
        costExGst: itemCost,
        sellIncGst: sell,
        marginPercent: margin,
        totalUnitsSold: sales.units,
        totalRevenue: sales.revenue,
        totalProfit: sales.revenue > 0 ? profit * sales.units : 0,
        avgWeeklySales: weeksInPeriod > 0 ? sales.units / weeksInPeriod : 0,
        avgWeeklyProfit: weeksInPeriod > 0 ? (profit * sales.units) / weeksInPeriod : 0,
        weeksWithSales: sales.weeks,
        similarGroup: similarGroups.get(item.id),
        decision: decisionLookup.get(item.id) as any,
      };
    });

    console.log(`📊 Summary: ${itemsWithSales} with sales, ${itemsWithoutSales} without sales, ${itemsWithoutSquareId} missing Square IDs`);

    // Extract unique filter options for dropdowns
    const allShelfLabels = Array.from(new Set(items.map(item => item.subcategory).filter(Boolean))).sort();
    const allCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean))).sort();

    return createSuccessResponse({
      items: result,
      summary: {
        totalItems: items.length,
        itemsWithSales,
        itemsWithoutSales: itemsWithoutSales,
        itemsNoSales: itemsWithoutSales, // Alias for frontend compatibility
        staples: result.filter(r => r.decision === 'staple').length,
        toRemove: result.filter(r => r.decision === 'remove').length,
        toKeep: result.filter(r => r.decision === 'keep').length,
        undecided: result.filter(r => !r.decision).length,
        weeks: weeksInPeriod,
        startDate: startDate.toISOString().split('T')[0],
        weeksAnalyzed: weeksInPeriod,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        message: itemsWithoutSquareId > 0 
          ? `${itemsWithoutSquareId} items missing Square catalog IDs - run Square catalog sync to fix`
          : 'All items have Square catalog IDs - perfect matching'
      },
      filters: {
        shelfLabels: allShelfLabels,
        categories: allCategories,
      },
    });

  } catch (error) {
    console.error('Product rationalization error:', error);
    return createErrorResponse(
      'RATIONALIZATION_ERROR', 
      `Failed to analyze products: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      500
    );
  }
}