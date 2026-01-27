import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Fetch vendors with related data
    const vendors = await prisma.vendor.findMany({
      include: {
        items: {
          select: { id: true, name: true, category: true, currentCostExGst: true, currentSellExGst: true, currentMarkup: true },
        },
        invoices: {
          where: { createdAt: { gte: sixMonthsAgo } },
          select: {
            id: true,
            invoiceDate: true,
            subtotalExGst: true,
            totalIncGst: true,
            status: true,
            createdAt: true,
            lineItems: {
              select: { id: true },
            },
          },
          orderBy: { invoiceDate: 'desc' },
        },
        orderSchedules: {
          select: { orderDay: true, deliveryDay: true, frequency: true, leadTimeDays: true, isActive: true },
        },
        purchaseOrders: {
          where: { createdAt: { gte: sixMonthsAgo } },
          select: { id: true, status: true, subtotalExGst: true, createdAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch price history for trend analysis
    const priceChanges = await prisma.itemPriceHistory.findMany({
      where: { changedAt: { gte: sixMonthsAgo } },
      include: {
        item: { select: { name: true, vendorId: true, category: true } },
      },
      orderBy: { changedAt: 'desc' },
    });

    // Group price changes by vendor
    const priceChangesByVendor = new Map<string, typeof priceChanges>();
    for (const change of priceChanges) {
      if (!change.item.vendorId) continue;
      const existing = priceChangesByVendor.get(change.item.vendorId) || [];
      existing.push(change);
      priceChangesByVendor.set(change.item.vendorId, existing);
    }

    const vendorPerformance = vendors.map((vendor: any) => {
      const invoices = vendor.invoices || [];
      const totalInvoices = invoices.length;
      const totalInvoiceValue = invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalIncGst), 0);
      const avgInvoiceValue = totalInvoices > 0 ? totalInvoiceValue / totalInvoices : 0;

      // Order frequency: invoices per month over the period
      const monthsSpan = Math.max(1, 
        totalInvoices > 1 
          ? (new Date(invoices[0].invoiceDate).getTime() - new Date(invoices[invoices.length - 1].invoiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
          : 1
      );
      const ordersPerMonth = totalInvoices / monthsSpan;

      // Recent vs older invoices for spend trend
      const recentInvoices = invoices.filter((inv: any) => new Date(inv.createdAt) >= threeMonthsAgo);
      const olderInvoices = invoices.filter((inv: any) => new Date(inv.createdAt) < threeMonthsAgo);
      const recentAvg = recentInvoices.length > 0
        ? recentInvoices.reduce((s: number, i: any) => s + Number(i.totalIncGst), 0) / recentInvoices.length
        : 0;
      const olderAvg = olderInvoices.length > 0
        ? olderInvoices.reduce((s: number, i: any) => s + Number(i.totalIncGst), 0) / olderInvoices.length
        : 0;
      const spendTrend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

      // Price changes analysis
      const vendorPriceChanges = priceChangesByVendor.get(vendor.id) || [];

      // Item count and avg margin
      const itemCount = (vendor.items || []).length;
      const itemsWithPricing = (vendor.items || []).filter(
        (i: any) => Number(i.currentCostExGst) > 0 && Number(i.currentSellExGst) > 0
      );
      const avgMargin = itemsWithPricing.length > 0
        ? itemsWithPricing.reduce((sum: number, i: any) => {
            const cost = Number(i.currentCostExGst);
            const sell = Number(i.currentSellExGst);
            return sum + ((sell - cost) / sell) * 100;
          }, 0) / itemsWithPricing.length
        : 0;

      // Purchase orders
      const totalPOs = (vendor.purchaseOrders || []).length;
      const poValue = (vendor.purchaseOrders || []).reduce((s: number, po: any) => s + Number(po.subtotalExGst || 0), 0);

      // Schedule info
      const activeSchedules = (vendor.orderSchedules || []).filter((s: any) => s.isActive);

      return {
        id: vendor.id,
        name: vendor.name,
        itemCount,
        totalInvoices,
        totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100,
        avgInvoiceValue: Math.round(avgInvoiceValue * 100) / 100,
        ordersPerMonth: Math.round(ordersPerMonth * 10) / 10,
        spendTrend: Math.round(spendTrend * 10) / 10,
        recentInvoiceCount: recentInvoices.length,
        avgMargin: Math.round(avgMargin * 10) / 10,
        priceChangeCount: vendorPriceChanges.length,
        totalPurchaseOrders: totalPOs,
        poValue: Math.round(poValue * 100) / 100,
        schedules: activeSchedules.map((s: any) => ({
          orderDay: s.orderDay,
          deliveryDay: s.deliveryDay,
          frequency: s.frequency,
        })),
        lastInvoiceDate: invoices.length > 0 ? invoices[0].invoiceDate : null,
      };
    });

    // Sort by total spend descending
    const sortedBySpend = [...vendorPerformance].sort((a, b) => b.totalInvoiceValue - a.totalInvoiceValue);

    // Summary stats
    const activeVendors = vendorPerformance.filter((v) => v.totalInvoices > 0);
    const totalSpend = vendorPerformance.reduce((s, v) => s + v.totalInvoiceValue, 0);

    return createSuccessResponse({
      summary: {
        totalVendors: vendors.length,
        activeVendors: activeVendors.length,
        totalSpend6Months: Math.round(totalSpend * 100) / 100,
        avgSpendPerVendor: Math.round((totalSpend / (activeVendors.length || 1)) * 100) / 100,
      },
      vendors: sortedBySpend,
    });
  } catch (error) {
    console.error('Vendor performance error:', error);
    return createErrorResponse('VENDOR_PERF_ERROR', 'Failed to generate vendor performance report', 500);
  }
}
