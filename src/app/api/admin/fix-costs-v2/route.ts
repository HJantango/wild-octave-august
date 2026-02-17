import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

/**
 * More aggressive cost fix - catches items like coconut water where both
 * cost AND sell price are case prices (so margin looks normal)
 * 
 * Rules:
 * - cost > $20 = flag (most retail items shouldn't cost this much per unit)
 * - cost > $15 AND margin < 50% = flag
 * - sell > $50 AND cost > $10 = flag (both likely case prices)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    const allItems = await prisma.item.findMany({
      select: {
        id: true,
        name: true,
        currentCostExGst: true,
        currentSellIncGst: true,
        currentSellExGst: true,
        vendor: { select: { name: true } },
      },
    });

    const badItems: Array<{
      id: string;
      name: string;
      vendor: string | null;
      cost: number;
      sellIncGst: number;
      sellExGst: number;
      issue: string;
    }> = [];

    for (const item of allItems) {
      const cost = Number(item.currentCostExGst);
      const sellIncGst = Number(item.currentSellIncGst);
      const sellExGst = Number(item.currentSellExGst);

      if (cost <= 0 || sellExGst <= 0) continue;

      const marginPercent = ((sellExGst - cost) / sellExGst) * 100;
      let issue = '';
      let isBad = false;

      // Rule 1: cost >= sell (clearly wrong)
      if (cost >= sellExGst) {
        issue = `Cost ($${cost.toFixed(2)}) >= Sell ($${sellExGst.toFixed(2)})`;
        isBad = true;
      }
      // Rule 2: margin < 10% (suspiciously low)
      else if (marginPercent < 10) {
        issue = `Margin only ${marginPercent.toFixed(1)}%`;
        isBad = true;
      }
      // Rule 3: cost > $20 (too high for most retail items)
      else if (cost > 20) {
        issue = `Cost $${cost.toFixed(2)} > $20 threshold`;
        isBad = true;
      }
      // Rule 4: cost > $15 with < 50% margin
      else if (cost > 15 && marginPercent < 50) {
        issue = `Cost $${cost.toFixed(2)} with only ${marginPercent.toFixed(1)}% margin`;
        isBad = true;
      }
      // Rule 5: high sell + high cost (both probably case prices)
      else if (sellIncGst > 50 && cost > 10) {
        issue = `Sell $${sellIncGst.toFixed(2)} + Cost $${cost.toFixed(2)} - both may be case prices`;
        isBad = true;
      }

      if (isBad) {
        badItems.push({
          id: item.id,
          name: item.name,
          vendor: item.vendor?.name || null,
          cost,
          sellIncGst,
          sellExGst,
          issue,
        });
      }
    }

    badItems.sort((a, b) => b.cost - a.cost);

    let fixed = 0;
    if (!dryRun && badItems.length > 0) {
      const badIds = badItems.map(i => i.id);
      const result = await prisma.item.updateMany({
        where: { id: { in: badIds } },
        data: { 
          currentCostExGst: 0,
          currentMarkup: 0,
        },
      });
      fixed = result.count;
    }

    return createSuccessResponse({
      dryRun,
      summary: {
        totalItems: allItems.length,
        badCostItems: badItems.length,
        fixed: dryRun ? 0 : fixed,
      },
      badItems: badItems.slice(0, 100),
      message: dryRun 
        ? `Found ${badItems.length} items with suspicious costs. POST with {dryRun: false} to fix.`
        : `Reset ${fixed} items to $0 cost.`,
    });
  } catch (error: any) {
    console.error('Fix costs error:', error);
    return createErrorResponse('FIX_COSTS_ERROR', error.message, 500);
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ dryRun: true }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';
