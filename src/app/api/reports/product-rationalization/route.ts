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

// Normalize item names for matching (handles "200g" vs "200 grams" etc)
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Normalize weight units
    .replace(/(\d+)\s*grams?\b/gi, '$1g')
    .replace(/(\d+)\s*gm\b/gi, '$1g')
    .replace(/(\d+)\s*kilograms?\b/gi, '$1kg')
    .replace(/(\d+)\s*kgs?\b/gi, '$1kg')
    .replace(/(\d+)\s*mls?\b/gi, '$1ml')
    .replace(/(\d+)\s*millilitres?\b/gi, '$1ml')
    .replace(/(\d+)\s*litres?\b/gi, '$1l')
    .replace(/(\d+)\s*l\b/gi, '$1l')
    // Normalize common abbreviations
    .replace(/\borg\.?\b/gi, 'organic')
    .replace(/\bnat\.?\b/gi, 'natural')
    .replace(/\bgf\b/gi, 'gluten free')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove special chars except alphanumeric and spaces
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Generate multiple matching keys for an item
function getMatchKeys(name: string): string[] {
  const normalized = normalizeItemName(name);
  const keys = [normalized];
  
  // Also try without common prefixes/suffixes that might differ
  const withoutOrganic = normalized.replace(/\borganic\s*/g, '').trim();
  if (withoutOrganic !== normalized) keys.push(withoutOrganic);
  
  const withoutRaw = normalized.replace(/\braw\s*/g, '').trim();
  if (withoutRaw !== normalized) keys.push(withoutRaw);
  
  return keys;
}

// Extract keywords for similarity matching
function extractKeywords(name: string): string[] {
  const stopWords = ['the', 'and', 'or', 'a', 'an', 'of', 'in', 'for', 'with', 'organic', 'natural', 'raw', 'vegan', 'gluten', 'free'];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

// Find similar products by keyword overlap
function findSimilarGroups(items: { id: string; name: string }[]): Map<string, string> {
  const groups = new Map<string, string[]>(); // keyword -> item ids
  const itemGroups = new Map<string, string>(); // item id -> group name

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
    const months = parseInt(searchParams.get('months') || '6');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

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

    // Get sales data from SquareDailySales
    const salesData = await prisma.squareDailySales.groupBy({
      by: ['itemName'],
      where: {
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        quantitySold: true,
        netSalesCents: true,
      },
      _count: {
        date: true,
      },
    });

    // Build sales lookup with normalized names for better matching
    const salesLookup = new Map<string, { units: number; revenue: number; weeks: number; originalName: string }>();
    for (const sale of salesData) {
      const normalizedKey = normalizeItemName(sale.itemName);
      const existing = salesLookup.get(normalizedKey);
      
      // Aggregate if same normalized name (handles variations)
      if (existing) {
        existing.units += Number(sale._sum.quantitySold) || 0;
        existing.revenue += ((sale._sum.netSalesCents || 0) / 100);
        existing.weeks += sale._count.date || 0;
      } else {
        salesLookup.set(normalizedKey, {
          units: Number(sale._sum.quantitySold) || 0,
          revenue: (sale._sum.netSalesCents || 0) / 100,
          weeks: sale._count.date || 0,
          originalName: sale.itemName,
        });
      }
    }
    
    // Also create direct name lookup for exact matches
    const directLookup = new Map<string, { units: number; revenue: number; weeks: number }>();
    for (const sale of salesData) {
      directLookup.set(sale.itemName.toLowerCase().trim(), {
        units: Number(sale._sum.quantitySold) || 0,
        revenue: (sale._sum.netSalesCents || 0) / 100,
        weeks: sale._count.date || 0,
      });
    }

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

    // Calculate weeks in period
    const weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Helper to find sales for an item (tries multiple matching strategies)
    function findSalesForItem(itemName: string): { units: number; revenue: number; weeks: number } {
      // 1. Try direct exact match first
      const direct = directLookup.get(itemName.toLowerCase().trim());
      if (direct && direct.units > 0) return direct;
      
      // 2. Try normalized match
      const normalizedKey = normalizeItemName(itemName);
      const normalized = salesLookup.get(normalizedKey);
      if (normalized && normalized.units > 0) return normalized;
      
      // 3. Try partial matching - find Square item that contains our item name
      const itemLower = itemName.toLowerCase();
      for (const [squareName, data] of directLookup.entries()) {
        if (squareName.includes(itemLower) || itemLower.includes(squareName)) {
          if (data.units > 0) return data;
        }
      }
      
      // 4. Try fuzzy matching via match keys
      const keys = getMatchKeys(itemName);
      for (const key of keys) {
        const match = salesLookup.get(key);
        if (match && match.units > 0) return match;
      }
      
      return { units: 0, revenue: 0, weeks: 0 };
    }

    // Build result
    const result: ProductRationalizationItem[] = items.map(item => {
      const sales = findSalesForItem(item.name);
      const cost = Number(item.currentCostExGst) || 0;
      const sell = Number(item.currentSellIncGst) || 0;
      const sellExGst = sell / 1.1;
      const marginPercent = sell > 0 && cost > 0 
        ? ((sellExGst - cost) / sellExGst) * 100 
        : 0;
      
      // Calculate profit: (sell ex GST - cost) * units sold
      const profitPerUnit = sellExGst - cost;
      const totalProfit = profitPerUnit * sales.units;
      const avgWeeklyProfit = totalProfit / weeksInPeriod;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        shelfLabel: item.subcategory || null,
        vendorName: item.vendor?.name || null,
        sku: item.sku || null,
        costExGst: cost,
        sellIncGst: sell,
        marginPercent: Math.round(marginPercent * 10) / 10,
        totalUnitsSold: sales.units,
        totalRevenue: Math.round(sales.revenue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgWeeklySales: Math.round((sales.units / weeksInPeriod) * 10) / 10,
        avgWeeklyProfit: Math.round(avgWeeklyProfit * 100) / 100,
        weeksWithSales: sales.weeks,
        similarGroup: similarGroups.get(item.id) || undefined,
        decision: decisionLookup.get(item.id) as any || null,
      };
    });

    // Get all shelf labels for filter
    const shelfLabels = await prisma.item.findMany({
      select: { subcategory: true },
      distinct: ['subcategory'],
    });

    const categories = await prisma.item.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    // Sort by shelf label, then by sales (low to high for easy culling)
    result.sort((a, b) => {
      if (a.shelfLabel !== b.shelfLabel) {
        return (a.shelfLabel || 'zzz').localeCompare(b.shelfLabel || 'zzz');
      }
      return a.totalUnitsSold - b.totalUnitsSold;
    });

    return createSuccessResponse({
      items: result,
      summary: {
        totalItems: result.length,
        itemsWithSales: result.filter(i => i.totalUnitsSold > 0).length,
        itemsNoSales: result.filter(i => i.totalUnitsSold === 0).length,
        staples: result.filter(i => i.decision === 'staple').length,
        toRemove: result.filter(i => i.decision === 'remove').length,
        toKeep: result.filter(i => i.decision === 'keep').length,
        undecided: result.filter(i => !i.decision).length,
        months,
      },
      filters: {
        shelfLabels: shelfLabels.map(s => s.subcategory).filter(Boolean).sort(),
        categories: categories.map(c => c.category).filter(Boolean).sort(),
      },
    });
  } catch (error: any) {
    console.error('Product rationalization error:', error);
    return createErrorResponse('RATIONALIZATION_ERROR', error.message, 500);
  }
}
