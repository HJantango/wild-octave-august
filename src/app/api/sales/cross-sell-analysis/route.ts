import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

const crossSellSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minSupport: z.number().min(0.01).max(1).default(0.05), // Minimum 5% of transactions
  minConfidence: z.number().min(0.1).max(1).default(0.3), // Minimum 30% confidence
  limit: z.number().min(10).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    const processedParams = {
      ...searchParams,
      minSupport: searchParams.minSupport ? parseFloat(searchParams.minSupport) : undefined,
      minConfidence: searchParams.minConfidence ? parseFloat(searchParams.minConfidence) : undefined,
      limit: searchParams.limit ? parseInt(searchParams.limit) : undefined,
    };

    const validation = validateRequest(crossSellSchema, processedParams);

    if (!validation.success) {
      return validation.error;
    }

    const { startDate, endDate, minSupport, minConfidence, limit } = validation.data;

    console.log(`🛒 Cross-sell analysis: support=${minSupport}, confidence=${minConfidence}`);

    // Build date filter
    const where: any = {
      quantitySold: { gt: 0 },
      itemName: { not: null },
    };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    } else {
      // Default to last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      where.date = { gte: threeMonthsAgo };
    }

    // Get daily transaction baskets
    // Group by date to simulate transaction baskets (customers buying multiple items same day)
    const dailyBaskets = await prisma.squareDailySales.groupBy({
      by: ['date'],
      where,
      _count: {
        _all: true,
      },
      having: {
        _all: {
          _count: {
            gt: 1, // Only days with multiple different items sold
          },
        },
      },
    });

    console.log(`📊 Found ${dailyBaskets.length} multi-item transaction days`);

    if (dailyBaskets.length === 0) {
      return createSuccessResponse({
        pairs: [],
        rules: [],
        summary: {
          totalBaskets: 0,
          totalItems: 0,
          dateRange: { start: null, end: null },
          parameters: { minSupport, minConfidence },
        },
      });
    }

    // Get all item combinations for these basket days
    const itemPairs: { [key: string]: number } = {};
    const itemCounts: { [key: string]: number } = {};
    let totalBaskets = dailyBaskets.length;

    // Process each basket day to find item co-occurrences
    for (const basket of dailyBaskets) {
      const basketItems = await prisma.squareDailySales.findMany({
        where: {
          date: basket.date,
          quantitySold: { gt: 0 },
          itemName: { not: null },
        },
        select: {
          itemName: true,
        },
        distinct: ['itemName'],
      });

      const uniqueItems = basketItems.map(item => item.itemName!);
      
      // Count individual items
      uniqueItems.forEach(item => {
        itemCounts[item] = (itemCounts[item] || 0) + 1;
      });

      // Count item pairs
      for (let i = 0; i < uniqueItems.length; i++) {
        for (let j = i + 1; j < uniqueItems.length; j++) {
          const item1 = uniqueItems[i];
          const item2 = uniqueItems[j];
          
          // Create consistent pair key (alphabetical order)
          const pairKey = item1 < item2 ? `${item1}|${item2}` : `${item2}|${item1}`;
          itemPairs[pairKey] = (itemPairs[pairKey] || 0) + 1;
        }
      }
    }

    // Calculate support and confidence for each pair
    const rules: Array<{
      itemA: string;
      itemB: string;
      support: number;
      confidence: number;
      lift: number;
      transactions: number;
      expectedTransactions: number;
    }> = [];

    Object.entries(itemPairs).forEach(([pairKey, count]) => {
      const [itemA, itemB] = pairKey.split('|');
      const support = count / totalBaskets;
      
      if (support >= minSupport) {
        const itemASupport = itemCounts[itemA] / totalBaskets;
        const itemBSupport = itemCounts[itemB] / totalBaskets;
        
        // Confidence: P(B|A) = P(A∩B) / P(A)
        const confidenceAB = support / itemASupport;
        const confidenceBA = support / itemBSupport;
        
        // Lift: how much more likely B is to be bought when A is bought
        const liftAB = confidenceAB / itemBSupport;
        const liftBA = confidenceBA / itemASupport;
        
        // Expected transactions if items were independent
        const expectedTransactions = Math.round(itemASupport * itemBSupport * totalBaskets);
        
        // Create bidirectional rules
        if (confidenceAB >= minConfidence) {
          rules.push({
            itemA,
            itemB,
            support,
            confidence: confidenceAB,
            lift: liftAB,
            transactions: count,
            expectedTransactions,
          });
        }
        
        if (confidenceBA >= minConfidence && itemA !== itemB) {
          rules.push({
            itemA: itemB,
            itemB: itemA,
            support,
            confidence: confidenceBA,
            lift: liftBA,
            transactions: count,
            expectedTransactions,
          });
        }
      }
    });

    // Sort by lift (highest correlation first), then confidence
    rules.sort((a, b) => {
      if (Math.abs(b.lift - a.lift) > 0.1) {
        return b.lift - a.lift;
      }
      return b.confidence - a.confidence;
    });

    // Get top pairs for summary
    const uniquePairs = Array.from(new Set(
      Object.keys(itemPairs).map(pairKey => {
        const [itemA, itemB] = pairKey.split('|');
        return { itemA, itemB, count: itemPairs[pairKey] };
      })
    )).sort((a, b) => b.count - a.count).slice(0, 20);

    const dateRange = await calculateDateRange(where);

    return createSuccessResponse({
      rules: rules.slice(0, limit),
      pairs: uniquePairs,
      summary: {
        totalBaskets,
        totalItems: Object.keys(itemCounts).length,
        totalRules: rules.length,
        strongRules: rules.filter(r => r.lift > 1.5 && r.confidence > 0.5).length,
        dateRange,
        parameters: { minSupport, minConfidence },
      },
      topItems: Object.entries(itemCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([item, count]) => ({ 
          item, 
          count, 
          frequency: count / totalBaskets 
        })),
    });

  } catch (error) {
    console.error('Cross-sell analysis error:', error);
    return createErrorResponse('ANALYSIS_ERROR', 'Failed to analyze cross-sell patterns', 500);
  }
}

async function calculateDateRange(where: any) {
  try {
    const dateStats = await prisma.squareDailySales.aggregate({
      where,
      _min: { date: true },
      _max: { date: true },
    });

    return {
      start: dateStats._min.date ? dateStats._min.date.getTime() : null,
      end: dateStats._max.date ? dateStats._max.date.getTime() : null,
    };
  } catch (error) {
    return { start: null, end: null };
  }
}

export const dynamic = 'force-dynamic';