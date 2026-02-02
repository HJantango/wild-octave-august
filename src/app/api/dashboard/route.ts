import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Fetch all data in parallel for performance
    const [
      upcomingDiary,
      overdueDiary,
      recentInvoices,
      lowStockItems,
      recentWastage,
      recentDiscounts,
      salesSummary,
      topSellingItems,
      rectificationPending,
      weekWastageTotals,
      weekDiscountTotals,
    ] = await Promise.all([
      // Upcoming diary entries (next 7 days)
      prisma.shopDiaryEntry.findMany({
        where: {
          dueDate: { gte: today, lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
          isCompleted: false,
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),

      // Overdue diary entries
      prisma.shopDiaryEntry.findMany({
        where: {
          dueDate: { lt: today },
          isCompleted: false,
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),

      // Recent invoices (last 5)
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: weekAgo },
        },
        include: {
          vendor: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Low stock items (below reorder point) - fetch all and filter in JavaScript
      prisma.inventoryItem.findMany({
        include: {
          item: {
            select: { name: true, category: true, vendor: { select: { name: true } } },
          },
        },
        orderBy: { currentStock: 'asc' },
      }),

      // Recent wastage (last 30 days)
      prisma.wastageRecord.findMany({
        where: {
          adjustmentDate: { gte: monthAgo },
        },
        include: {
          item: {
            select: { name: true, currentCostExGst: true },
          },
        },
        orderBy: { adjustmentDate: 'desc' },
        take: 10,
      }),

      // Recent discounts (last 30 days)
      prisma.discountRecord.findMany({
        where: {
          saleDate: { gte: monthAgo },
        },
        include: {
          item: {
            select: { name: true, currentSellExGst: true },
          },
        },
        orderBy: { saleDate: 'desc' },
        take: 10,
      }),

      // Sales summary (last 7 days) - try Square data first
      (async () => {
        const squareCount = await prisma.squareDailySales.count({ where: { date: { gte: weekAgo } } });
        if (squareCount > 0) {
          const result = await prisma.squareDailySales.aggregate({
            where: { date: { gte: weekAgo } },
            _sum: { netSalesCents: true, quantitySold: true },
            _count: true,
          });
          return {
            _sum: {
              revenue: (result._sum.netSalesCents || 0) / 100,
              quantity: result._sum.quantitySold,
              margin: 0, // Square doesn't have margin data
            },
            _count: result._count,
          };
        }
        return prisma.salesAggregate.aggregate({
          where: { date: { gte: weekAgo } },
          _sum: { revenue: true, quantity: true, margin: true },
          _count: true,
        });
      })(),

      // Top selling items (last 7 days) - try Square data first
      (async () => {
        const squareCount = await prisma.squareDailySales.count({ where: { date: { gte: weekAgo } } });
        if (squareCount > 0) {
          const items = await prisma.squareDailySales.groupBy({
            by: ['itemName', 'category'],
            where: { date: { gte: weekAgo } },
            _sum: { netSalesCents: true, quantitySold: true },
            orderBy: { _sum: { netSalesCents: 'desc' } },
            take: 10,
          });
          return items.map(item => ({
            itemName: item.itemName,
            category: item.category,
            _sum: {
              revenue: (item._sum.netSalesCents || 0) / 100,
              quantity: item._sum.quantitySold,
            },
          }));
        }
        return prisma.salesAggregate.groupBy({
          by: ['itemName', 'category'],
          where: { date: { gte: weekAgo } },
          _sum: { revenue: true, quantity: true },
          orderBy: { _sum: { revenue: 'desc' } },
          take: 10,
        });
      })(),

      // Invoices pending rectification
      prisma.invoice.count({
        where: {
          needsRectification: true,
          rectificationResolvedAt: null,
        },
      }),

      // Week wastage totals (last 7 days)
      prisma.wastageRecord.aggregate({
        where: {
          adjustmentDate: { gte: weekAgo },
        },
        _sum: {
          totalCost: true,
        },
      }),

      // Week discount totals (last 7 days)
      prisma.discountRecord.aggregate({
        where: {
          saleDate: { gte: weekAgo },
        },
        _sum: {
          discountAmount: true,
        },
      }),
    ]);

    // Filter low stock items (compare currentStock to reorderPoint or minimumStock)
    const filteredLowStockItems = lowStockItems
      .filter(item =>
        item.currentStock <= item.reorderPoint ||
        item.currentStock <= item.minimumStock
      )
      .slice(0, 10);

    // Calculate wastage totals with safety checks
    const wastageTotals = recentWastage.reduce(
      (acc, record) => {
        const itemCost = Number(record.item.currentCostExGst) || 0;
        const qty = Number(record.quantity) || 0;
        const cost = itemCost * qty;
        return {
          quantity: acc.quantity + qty,
          cost: acc.cost + (isNaN(cost) ? 0 : cost),
        };
      },
      { quantity: 0, cost: 0 }
    );

    // Calculate discount totals with safety checks
    const discountTotals = recentDiscounts.reduce(
      (acc, record) => {
        const qty = Number(record.quantity) || 0;
        const amount = Number(record.discountAmount) || 0;
        return {
          quantity: acc.quantity + qty,
          amount: acc.amount + (isNaN(amount) ? 0 : amount),
        };
      },
      { quantity: 0, amount: 0 }
    );

    const dashboardData = {
      diary: {
        upcoming: upcomingDiary,
        overdue: overdueDiary,
        overdueCount: overdueDiary.length,
      },
      invoices: {
        recent: recentInvoices.map(inv => ({
          id: inv.id,
          vendorName: inv.vendor.name,
          invoiceNumber: inv.invoiceNumber,
          totalIncGst: Number(inv.totalIncGst),
          status: inv.status,
          createdAt: inv.createdAt,
          needsRectification: inv.needsRectification,
        })),
        rectificationPending,
      },
      inventory: {
        lowStock: filteredLowStockItems.map(item => ({
          id: item.id,
          name: item.item.name,
          category: item.item.category,
          vendorName: item.item.vendor?.name,
          currentStock: item.currentStock,
          reorderPoint: item.reorderPoint,
          minimumStock: item.minimumStock,
        })),
        lowStockCount: filteredLowStockItems.length,
      },
      wastage: {
        recentItems: recentWastage.map(w => {
          const itemCost = Number(w.item.currentCostExGst) || 0;
          const qty = Number(w.quantity) || 0;
          const cost = itemCost * qty;
          return {
            itemName: w.item.name,
            quantity: qty,
            cost: isNaN(cost) ? 0 : cost,
            reason: w.reason,
            adjustmentDate: w.adjustmentDate,
          };
        }),
        totals: wastageTotals,
      },
      discounts: {
        recentItems: recentDiscounts.map(d => {
          const qty = Number(d.quantity) || 0;
          const amount = Number(d.discountAmount) || 0;
          return {
            itemName: d.item.name,
            quantity: qty,
            discountAmount: isNaN(amount) ? 0 : amount,
            saleDate: d.saleDate,
          };
        }),
        totals: discountTotals,
      },
      sales: {
        weekTotal: Number(salesSummary._sum.revenue || 0),
        weekQuantity: Number(salesSummary._sum.quantity || 0),
        weekMargin: Number(salesSummary._sum.margin || 0),
        weekWastage: Number(weekWastageTotals._sum.totalCost || 0),
        weekDiscounts: Number(weekDiscountTotals._sum.discountAmount || 0),
        weekNetProfit: Number(salesSummary._sum.margin || 0) - Number(weekWastageTotals._sum.totalCost || 0) - Number(weekDiscountTotals._sum.discountAmount || 0),
        topItems: topSellingItems.map(item => ({
          itemName: item.itemName,
          category: item.category,
          revenue: Number(item._sum.revenue || 0),
          quantity: Number(item._sum.quantity || 0),
        })),
      },
    };

    return createSuccessResponse(dashboardData, 'Dashboard data retrieved successfully');
  } catch (error) {
    console.error('Dashboard data error:', error);
    return createErrorResponse('DASHBOARD_ERROR', 'Failed to fetch dashboard data', 500);
  }
}
