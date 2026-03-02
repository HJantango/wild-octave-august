import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Check recent sales for Heaps Good items
    const recentSales = await prisma.squareDailySales.findMany({
      where: {
        OR: [
          { itemName: { contains: 'heaps good', mode: 'insensitive' } },
          { itemName: { contains: 'heaps', mode: 'insensitive' } },
          { vendorName: { contains: 'heaps good', mode: 'insensitive' } },
          { vendorName: { contains: 'heaps', mode: 'insensitive' } },
        ]
      },
      select: {
        itemName: true,
        vendorName: true,
        date: true,
        quantitySold: true,
      },
      take: 10,
      orderBy: { date: 'desc' },
    });

    // Check all unique vendors in sales data
    const allVendors = await prisma.squareDailySales.groupBy({
      by: ['vendorName'],
      where: {
        vendorName: { not: null },
        date: { gte: new Date('2025-01-01') }, // Recent data
      },
      _count: { vendorName: true },
      orderBy: { _count: { vendorName: 'desc' } },
      take: 50,
    });

    // Check vendors table
    const dbVendors = await prisma.vendor.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    // Check items with Heaps Good in the name
    const heapsGoodItems = await prisma.item.findMany({
      where: {
        name: { contains: 'heaps', mode: 'insensitive' },
      },
      select: {
        name: true,
        vendor: { select: { name: true } },
      },
    });

    return createSuccessResponse({
      heapsGoodSales: recentSales,
      salesVendors: allVendors.map(v => ({ 
        vendor: v.vendorName, 
        count: v._count.vendorName 
      })),
      databaseVendors: dbVendors.map(v => v.name),
      heapsGoodItems: heapsGoodItems,
      summary: {
        heapsGoodSalesFound: recentSales.length,
        totalSalesVendors: allVendors.length,
        totalDbVendors: dbVendors.length,
        heapsGoodItemsFound: heapsGoodItems.length,
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