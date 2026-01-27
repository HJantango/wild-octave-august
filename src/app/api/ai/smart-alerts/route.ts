import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const endDate = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    // Fetch recent sales (last 4 weeks)
    const recentSales = await prisma.squareDailySales.findMany({
      where: { date: { gte: fourWeeksAgo, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    // Fetch previous period sales (4-8 weeks ago) for comparison
    const previousSales = await prisma.squareDailySales.findMany({
      where: { date: { gte: eightWeeksAgo, lt: fourWeeksAgo } },
      orderBy: { date: 'asc' },
    });

    // Fetch wastage data (last 4 weeks)
    const wastageRecords = await prisma.wastageRecord.findMany({
      where: { adjustmentDate: { gte: fourWeeksAgo, lte: endDate } },
      include: { item: { select: { name: true, currentCostExGst: true } } },
    });

    // Aggregate recent sales by item
    const recentByItem = new Map<string, { qty: number; revenue: number; lastSaleDate: Date }>();
    for (const record of recentSales) {
      const key = record.itemName;
      const existing = recentByItem.get(key) || { qty: 0, revenue: 0, lastSaleDate: new Date(0) };
      existing.qty += Number(record.quantitySold);
      existing.revenue += record.grossSalesCents / 100;
      const recordDate = new Date(record.date);
      if (recordDate > existing.lastSaleDate) existing.lastSaleDate = recordDate;
      recentByItem.set(key, existing);
    }

    // Aggregate previous sales by item
    const prevByItem = new Map<string, { qty: number; revenue: number }>();
    for (const record of previousSales) {
      const key = record.itemName;
      const existing = prevByItem.get(key) || { qty: 0, revenue: 0 };
      existing.qty += Number(record.quantitySold);
      existing.revenue += record.grossSalesCents / 100;
      prevByItem.set(key, existing);
    }

    // Aggregate wastage by item
    const wastageByItem = new Map<string, { qty: number; cost: number }>();
    for (const wr of wastageRecords) {
      const name = wr.item?.name || wr.itemName;
      const existing = wastageByItem.get(name) || { qty: 0, cost: 0 };
      existing.qty += Number(wr.quantity);
      existing.cost += Number(wr.totalCost);
      wastageByItem.set(name, existing);
    }

    const alerts: Array<{
      type: 'declining_sales' | 'increasing_sales' | 'high_wastage' | 'dead_stock';
      severity: 'info' | 'warning' | 'critical';
      itemName: string;
      message: string;
      metric: string;
      actionSuggestion: string;
    }> = [];

    // Check for declining sales
    for (const [item, recent] of Array.from(recentByItem.entries())) {
      const prev = prevByItem.get(item);
      if (prev && prev.qty > 2) {
        const change = ((recent.qty - prev.qty) / prev.qty) * 100;
        if (change < -25) {
          alerts.push({
            type: 'declining_sales',
            severity: change < -50 ? 'critical' : 'warning',
            itemName: item,
            message: `Sales dropped ${Math.abs(change).toFixed(0)}% vs previous 4 weeks`,
            metric: `${recent.qty.toFixed(1)} → was ${prev.qty.toFixed(1)} units`,
            actionSuggestion: 'Consider reducing next order quantity',
          });
        }
      }
    }

    // Check for increasing sales
    for (const [item, recent] of Array.from(recentByItem.entries())) {
      const prev = prevByItem.get(item);
      if (prev && prev.qty > 2) {
        const change = ((recent.qty - prev.qty) / prev.qty) * 100;
        if (change > 25) {
          alerts.push({
            type: 'increasing_sales',
            severity: 'info',
            itemName: item,
            message: `Sales up ${change.toFixed(0)}% vs previous 4 weeks`,
            metric: `${recent.qty.toFixed(1)} ← was ${prev.qty.toFixed(1)} units`,
            actionSuggestion: 'Consider ordering extra to meet demand',
          });
        }
      }
    }

    // Check for high wastage ratio
    for (const [item, wastage] of Array.from(wastageByItem.entries())) {
      const sales = recentByItem.get(item);
      const salesQty = sales?.qty || 0;
      if (salesQty > 0) {
        const wastageRatio = (wastage.qty / (salesQty + wastage.qty)) * 100;
        if (wastageRatio > 10) {
          alerts.push({
            type: 'high_wastage',
            severity: wastageRatio > 25 ? 'critical' : 'warning',
            itemName: item,
            message: `${wastageRatio.toFixed(0)}% wastage ratio (${wastage.qty.toFixed(1)} wasted of ${(salesQty + wastage.qty).toFixed(1)} total)`,
            metric: `Cost: $${wastage.cost.toFixed(2)} lost`,
            actionSuggestion: 'Reduce order quantity or check storage/handling',
          });
        }
      } else if (wastage.qty > 0) {
        alerts.push({
          type: 'high_wastage',
          severity: 'critical',
          itemName: item,
          message: `${wastage.qty.toFixed(1)} units wasted with no sales recorded`,
          metric: `Cost: $${wastage.cost.toFixed(2)} lost`,
          actionSuggestion: 'Stop ordering this item or investigate',
        });
      }
    }

    // Check for dead stock (items sold previously but not in last 2 weeks)
    for (const [item, prev] of Array.from(prevByItem.entries())) {
      if (prev.qty >= 2) {
        const recent = recentByItem.get(item);
        const recentQty = recent?.qty || 0;
        const lastSale = recent?.lastSaleDate || new Date(0);

        if (recentQty === 0 || lastSale < twoWeeksAgo) {
          alerts.push({
            type: 'dead_stock',
            severity: 'warning',
            itemName: item,
            message: recentQty === 0
              ? 'No sales in the last 4 weeks (previously sold)'
              : `No sales in 2+ weeks (last sale: ${lastSale.toLocaleDateString('en-AU')})`,
            metric: `Was selling ${(prev.qty / 4).toFixed(1)}/week`,
            actionSuggestion: 'Consider discontinuing or running a promotion',
          });
        }
      }
    }

    // Sort alerts: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Summary counts
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      byType: {
        declining_sales: alerts.filter(a => a.type === 'declining_sales').length,
        increasing_sales: alerts.filter(a => a.type === 'increasing_sales').length,
        high_wastage: alerts.filter(a => a.type === 'high_wastage').length,
        dead_stock: alerts.filter(a => a.type === 'dead_stock').length,
      },
    };

    return createSuccessResponse({
      alerts: alerts.slice(0, 50), // Top 50 alerts
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Smart alerts error:', error);
    return createErrorResponse('ALERTS_ERROR', `Failed to generate alerts: ${error.message}`, 500);
  }
}

export const dynamic = 'force-dynamic';
