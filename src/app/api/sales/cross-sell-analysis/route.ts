import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Use actual cafe categories instead of keyword guessing
const CAFE_CATEGORIES = ['Cafe Food', 'Cafe Drinks'];

function isCafeItem(category: string | null): boolean {
  return category ? CAFE_CATEGORIES.includes(category) : false;
}

export async function GET(request: NextRequest) {
  try {
    console.log('☕ Cafe-focused cross-sell analysis API called');

    // First, let's check if we have any Square data at all
    const dataCount = await prisma.squareDailySales.count();
    console.log(`📊 Total SquareDailySales records: ${dataCount}`);

    if (dataCount === 0) {
      return createSuccessResponse({
        rules: [],
        pairs: [],
        summary: {
          totalBaskets: 0,
          totalItems: 0,
          totalRules: 0,
          strongRules: 0,
          dateRange: { start: null, end: null },
          parameters: { minSupport: 0.05, minConfidence: 0.3 },
        },
        topItems: [],
        message: 'No Square sales data found. Try syncing your Square data first.',
      });
    }

    // Get a larger sample of recent data for better patterns  
    const recentData = await prisma.squareDailySales.findMany({
      take: 1000,
      orderBy: { date: 'desc' },
      select: {
        date: true,
        itemName: true,
        category: true,
        quantitySold: true,
        netSalesCents: true,
      },
    });

    console.log(`📊 Recent data sample: ${recentData.length} records`);
    
    // Count cafe vs non-cafe items using actual categories
    const cafeItems = new Set();
    const allItems = new Set();
    recentData.forEach(record => {
      if (record.itemName) {
        allItems.add(record.itemName);
        if (isCafeItem(record.category)) {
          cafeItems.add(record.itemName);
        }
      }
    });
    
    console.log(`☕ Found ${cafeItems.size} cafe items out of ${allItems.size} total unique items`);
    console.log(`📋 Categories found: ${[...new Set(recentData.map(r => r.category).filter(Boolean))].join(', ')}`);

    // Group by date to simulate transaction baskets (with category info)
    const dateGroups: { [key: string]: Array<{name: string, category: string | null}> } = {};
    
    recentData.forEach(record => {
      if (!record.itemName || record.quantitySold <= 0) return;
      
      const dateKey = record.date.toISOString().split('T')[0];
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      
      const existingItem = dateGroups[dateKey].find(item => item.name === record.itemName);
      if (!existingItem) {
        dateGroups[dateKey].push({ 
          name: record.itemName, 
          category: record.category 
        });
      }
    });

    // Find days with multiple items (our "baskets")
    const multiItemDays = Object.entries(dateGroups).filter(([_, items]) => items.length > 1);
    
    console.log(`📊 Multi-item days found: ${multiItemDays.length}`);

    // Count item pairs
    const pairCounts: { [key: string]: number } = {};
    const itemCounts: { [key: string]: number } = {};

    multiItemDays.forEach(([date, items]) => {
      // Count individual items  
      items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
      });

      // Count pairs (only where at least one item is a cafe item)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const item1 = items[i];
          const item2 = items[j];
          
          // Only count pairs where at least one item is a cafe item
          if (isCafeItem(item1.category) || isCafeItem(item2.category)) {
            const pairKey = item1.name < item2.name ? `${item1.name}|${item2.name}` : `${item2.name}|${item1.name}`;
            pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
          }
        }
      }
    });

    // Create simple rules (top 10 pairs)
    const simpleRules = Object.entries(pairCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([pairKey, count]) => {
        const [itemA, itemB] = pairKey.split('|');
        const support = count / multiItemDays.length;
        const confidenceAB = count / (itemCounts[itemA] || 1);
        const confidenceBA = count / (itemCounts[itemB] || 1);
        const lift = confidenceAB / ((itemCounts[itemB] || 1) / multiItemDays.length);

        return {
          itemA,
          itemB,
          support,
          confidence: Math.max(confidenceAB, confidenceBA),
          lift: Math.max(lift, 1),
          transactions: count,
          expectedTransactions: Math.round((itemCounts[itemA] || 1) * (itemCounts[itemB] || 1) / multiItemDays.length),
        };
      });

    // Top items by frequency
    const topItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([item, count]) => ({
        item,
        count,
        frequency: count / multiItemDays.length,
      }));

    console.log(`📊 Generated ${simpleRules.length} rules, ${topItems.length} top items`);

    return createSuccessResponse({
      rules: simpleRules,
      pairs: Object.entries(pairCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([pairKey, count]) => {
          const [itemA, itemB] = pairKey.split('|');
          return { 
            itemA, 
            itemB, 
            count,
            cafeItemA: isCafeItem(itemA),
            cafeItemB: isCafeItem(itemB)
          };
        }),
      summary: {
        totalBaskets: multiItemDays.length,
        totalItems: Object.keys(itemCounts).length,
        cafeItems: cafeItems.size,
        totalRules: simpleRules.length,
        strongRules: simpleRules.filter(r => r.lift > 1.2).length,
        dateRange: {
          start: new Date(Math.min(...multiItemDays.map(([date]) => new Date(date).getTime()))).getTime(),
          end: new Date(Math.max(...multiItemDays.map(([date]) => new Date(date).getTime()))).getTime(),
        },
        parameters: { minSupport: 0.05, minConfidence: 0.3 },
        filterType: 'cafe-focused',
      },
      topItems: topItems.map(item => {
        // Find the category for this item from our data
        const itemRecord = recentData.find(record => record.itemName === item.item);
        return {
          ...item,
          isCafeItem: isCafeItem(itemRecord?.category || null),
          category: itemRecord?.category || null,
        };
      }),
      message: `Analysis focused on cafe item cross-sells. Found ${cafeItems.size} cafe items out of ${allItems.size} total items.`,
    });

  } catch (error) {
    console.error('❌ Cross-sell analysis error:', error);
    
    return createErrorResponse(
      'ANALYSIS_ERROR', 
      `Failed to analyze cross-sell patterns: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      500
    );
  }
}

export const dynamic = 'force-dynamic';