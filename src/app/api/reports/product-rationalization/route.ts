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
    // Remove possessive apostrophes first (Olsson's → Olssons)
    .replace(/\b(\w+)'\s*s\b/g, '$1s')
    // Remove common brand prefixes that cause mismatches
    .replace(/^(olssons?|celtic|maldon|murray river)\s+/gi, '')
    .replace(/\s+(olssons?|celtic|maldon|murray river)\s+/gi, ' ')
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
    // Remove punctuation and brackets that cause issues
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ')
    .trim();
}

// Generate multiple matching keys for an item
function getMatchKeys(name: string): string[] {
  const normalized = normalizeItemName(name);
  const keys = [normalized];
  
  // Try without common descriptive words
  const withoutOrganic = normalized.replace(/\borganic\s*/g, '').trim();
  if (withoutOrganic !== normalized && withoutOrganic) keys.push(withoutOrganic);
  
  const withoutRaw = normalized.replace(/\braw\s*/g, '').trim();
  if (withoutRaw !== normalized && withoutRaw) keys.push(withoutRaw);
  
  const withoutNatural = normalized.replace(/\bnatural\s*/g, '').trim();
  if (withoutNatural !== normalized && withoutNatural) keys.push(withoutNatural);
  
  // Try without size information for partial matches
  const withoutSize = normalized.replace(/\d+[a-z]*\b/g, '').replace(/\s+/g, ' ').trim();
  if (withoutSize !== normalized && withoutSize.length > 3) keys.push(withoutSize);
  
  // Generate word permutations for different word orders (limited to avoid explosion)
  const words = normalized.split(' ').filter(w => w.length > 0);
  if (words.length >= 2 && words.length <= 4) {
    // Try moving the last word to the front (handles "Sea Salt Flakes Black" vs "Black Sea Salt Flakes")
    if (words.length >= 3) {
      const lastFirst = [words[words.length - 1], ...words.slice(0, -1)].join(' ');
      if (!keys.includes(lastFirst)) keys.push(lastFirst);
    }
  }
  
  return [...new Set(keys)]; // Remove duplicates
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

    // Get sales data from SquareDailySales - include squareCatalogId for better matching
    const salesData = await prisma.squareDailySales.groupBy({
      by: ['itemName', 'squareCatalogId'],
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

    // SQUARE-FIRST PRINCIPLE: Build sales lookup by Square catalog ID first, then names as fallback
    const salesLookupBySquareId = new Map<string, { units: number; revenue: number; weeks: number; originalName: string }>();
    const salesLookupByName = new Map<string, { units: number; revenue: number; weeks: number; originalName: string }>();
    const directLookup = new Map<string, { units: number; revenue: number; weeks: number }>();
    
    for (const sale of salesData) {
      const units = Number(sale._sum.quantitySold) || 0;
      const revenue = (sale._sum.netSalesCents || 0) / 100;
      const weeks = sale._count.date || 0;
      const salesEntry = { units, revenue, weeks, originalName: sale.itemName };
      
      // Primary: Group by Square catalog ID if available
      if (sale.squareCatalogId) {
        const existing = salesLookupBySquareId.get(sale.squareCatalogId);
        if (existing) {
          existing.units += units;
          existing.revenue += revenue;
          existing.weeks += weeks;
        } else {
          salesLookupBySquareId.set(sale.squareCatalogId, { ...salesEntry });
        }
      }
      
      // Fallback: Also maintain name-based lookup (with normalization) for legacy items
      const normalizedKey = normalizeItemName(sale.itemName);
      const existingByName = salesLookupByName.get(normalizedKey);
      if (existingByName) {
        existingByName.units += units;
        existingByName.revenue += revenue;
        existingByName.weeks += weeks;
      } else {
        salesLookupByName.set(normalizedKey, { ...salesEntry });
      }
      
      // Direct name lookup for exact matches
      directLookup.set(sale.itemName.toLowerCase().trim(), { units, revenue, weeks });
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

    // Helper to find sales for an item - SQUARE-FIRST PRINCIPLE
    function findSalesForItem(item: { name: string; squareCatalogId?: string | null }): { units: number; revenue: number; weeks: number } {
      // 1. SQUARE-FIRST: Try direct Square catalog ID match (most accurate)
      if (item.squareCatalogId) {
        const squareMatch = salesLookupBySquareId.get(item.squareCatalogId);
        if (squareMatch && squareMatch.units > 0) {
          console.log(`✅ Square ID match: "${item.name}" → ${squareMatch.units} units via ${item.squareCatalogId}`);
          return squareMatch;
        }
      }
      
      // 2. Fall back to direct exact name match
      const direct = directLookup.get(item.name.toLowerCase().trim());
      if (direct && direct.units > 0) return direct;
      
      // 3. Fall back to normalized name matching (legacy items without Square IDs)
      const normalizedKey = normalizeItemName(item.name);
      const normalized = salesLookupByName.get(normalizedKey);
      if (normalized && normalized.units > 0) return normalized;
      
      // 4. Try fuzzy matching via match keys (for legacy items)
      const keys = getMatchKeys(item.name);
      for (const key of keys) {
        const match = salesLookupByName.get(key);
        if (match && match.units > 0) return match;
      }
      
      // 5. Last resort: partial matching for items without Square IDs
      if (!item.squareCatalogId) {
        const itemNormalized = normalizeItemName(item.name);
        const itemWords = itemNormalized.split(' ').filter(w => w.length > 2);
        const minWordsToMatch = Math.max(2, Math.ceil(itemWords.length * 0.7));
        
        for (const [squareName, data] of directLookup.entries()) {
          if (data.units === 0) continue;
          
          const squareNormalized = normalizeItemName(squareName);
          const squareWords = squareNormalized.split(' ');
          
          const matchingWords = itemWords.filter(word => 
            squareWords.some(sw => sw.includes(word) || word.includes(sw))
          );
          
          if (matchingWords.length >= minWordsToMatch) {
            console.log(`🔍 Partial match: "${item.name}" → "${squareName}" (${matchingWords.length}/${itemWords.length} words)`);
            return data;
          }
        }
      }
      
      return { units: 0, revenue: 0, weeks: 0 };
    }

    // Build result
    const result: ProductRationalizationItem[] = items.map(item => {
      const sales = findSalesForItem({ name: item.name, squareCatalogId: item.squareCatalogId });
      const itemCost = Number(item.currentCostExGst) || 0;
      const itemSell = Number(item.currentSellIncGst) || 0;
      
      // IMPORTANT: Use actual sell price from sales data if available (more accurate than Item table)
      // Sales revenue / units = actual average sell price (inc GST)
      const actualSellFromSales = sales.units > 0 ? sales.revenue / sales.units : 0;
      
      // Use actual sell price if we have sales, otherwise fall back to Item table
      const sell = actualSellFromSales > 0 ? actualSellFromSales : itemSell;
      const sellExGst = sell / 1.1;
      
      // IMPORTANT: Only trust cost if it's reasonable (< $20 per unit)
      // Higher costs are likely case/pack prices stored incorrectly
      const cost = itemCost > 0 && itemCost < 20 ? itemCost : 0;
      
      const marginPercent = sell > 0 && cost > 0 
        ? ((sellExGst - cost) / sellExGst) * 100 
        : 0;
      
      // Calculate profit: (sell ex GST - cost) * units sold
      const profitPerUnit = cost > 0 ? (sellExGst - cost) : 0;
      const totalProfit = profitPerUnit * sales.units;
      const avgWeeklyProfit = totalProfit / weeksInPeriod;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        shelfLabel: item.subcategory || null,
        vendorName: item.vendor?.name || null,
        sku: item.sku || null,
        costExGst: cost, // Will be 0 if unreasonable cost was detected
        sellIncGst: Math.round(sell * 100) / 100, // From actual sales when available
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
