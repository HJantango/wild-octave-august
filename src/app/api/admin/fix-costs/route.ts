import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

/**
 * Fixes items where cost > sell price (clearly wrong - case prices stored as unit costs)
 * Sets those costs to 0 so they can be re-entered properly from invoices
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run

    // Find all items where cost > sell price or margin is unrealistic
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

      if (cost <= 0 || sellExGst <= 0) continue; // Skip items without both values

      const marginPercent = ((sellExGst - cost) / sellExGst) * 100;
      let issue = '';

      if (cost >= sellExGst) {
        issue = `Cost ($${cost.toFixed(2)}) >= Sell ($${sellExGst.toFixed(2)}) - likely case price`;
      } else if (marginPercent < 10) {
        issue = `Margin only ${marginPercent.toFixed(1)}% - suspiciously low`;
      } else if (marginPercent > 80) {
        issue = `Margin ${marginPercent.toFixed(1)}% - unusually high but might be ok`;
      }

      if (cost >= sellExGst || marginPercent < 10) {
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

    // Sort by cost descending (worst offenders first)
    badItems.sort((a, b) => b.cost - a.cost);

    let fixed = 0;
    if (!dryRun && badItems.length > 0) {
      // Reset bad costs to 0
      const badIds = badItems.filter(i => i.cost >= i.sellExGst || 
        (((i.sellExGst - i.cost) / i.sellExGst) * 100) < 10
      ).map(i => i.id);

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
      badItems: badItems.slice(0, 100), // Limit output for readability
      message: dryRun 
        ? `Found ${badItems.length} items with suspicious costs. Run with dryRun: false to fix.`
        : `Reset ${fixed} items to $0 cost. Re-run catalog sync or enter costs from invoices.`,
    });
  } catch (error: any) {
    console.error('Fix costs error:', error);
    return createErrorResponse('FIX_COSTS_ERROR', error.message, 500);
  }
}

export async function GET() {
  // GET just shows info, doesn't fix
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ dryRun: true }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';
