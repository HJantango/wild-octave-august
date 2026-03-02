import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get recent sales with Heaps Good items (raw data)
    const recentSales = await prisma.squareDailySales.findMany({
      where: {
        OR: [
          { itemName: { contains: 'heaps good', mode: 'insensitive' } },
          { itemName: { contains: 'heaps', mode: 'insensitive' } },
        ],
        date: { gte: new Date('2025-01-01') },
      },
      select: {
        itemName: true,
        vendorName: true,
        squareCatalogId: true,
        date: true,
        quantitySold: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 20,
      orderBy: { date: 'desc' },
    });

    // Get a sample of ALL recent sales to see vendor distribution
    const allRecentSales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: new Date('2025-02-01') },
      },
      select: {
        vendorName: true,
      },
      take: 1000,
    });

    // Count vendor distribution
    const vendorCounts = new Map<string, number>();
    let nullVendorCount = 0;

    for (const sale of allRecentSales) {
      if (!sale.vendorName) {
        nullVendorCount++;
      } else {
        vendorCounts.set(sale.vendorName, (vendorCounts.get(sale.vendorName) || 0) + 1);
      }
    }

    const vendorStats = Array.from(vendorCounts.entries())
      .map(([vendor, count]) => ({ vendor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return createSuccessResponse({
      heapsGoodSales: recentSales,
      vendorStats: {
        totalSalesChecked: allRecentSales.length,
        nullVendorCount: nullVendorCount,
        nullVendorPercent: Math.round((nullVendorCount / allRecentSales.length) * 100),
        topVendors: vendorStats,
      },
      analysis: {
        heapsGoodRecords: recentSales.length,
        heapsGoodWithVendor: recentSales.filter(s => s.vendorName).length,
        heapsGoodWithoutVendor: recentSales.filter(s => !s.vendorName).length,
        heapsGoodWithSquareId: recentSales.filter(s => s.squareCatalogId).length,
      }
    });

  } catch (error: any) {
    return createSuccessResponse({
      error: error.message,
      diagnosis: "Database query failed",
    });
  }
}

export const dynamic = 'force-dynamic';