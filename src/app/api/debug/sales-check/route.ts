import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // 1. Check total sales records and date range
    const salesCount = await prisma.squareDailySales.count();
    const dateRange = await prisma.squareDailySales.aggregate({
      _min: { date: true },
      _max: { date: true },
    });

    // 2. Check for Heaps Good vendor
    const heapsGood = await prisma.vendor.findFirst({
      where: { name: { contains: 'Heaps', mode: 'insensitive' } },
    });

    // 3. Check for Carob item in sales
    const carobSales = await prisma.squareDailySales.findMany({
      where: { itemName: { contains: 'Carob', mode: 'insensitive' } },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // 4. Check for Carob in Items table
    const carobItem = await prisma.item.findFirst({
      where: { name: { contains: 'Carob', mode: 'insensitive' } },
      include: { vendor: true },
    });

    // 5. Check sales with vendorName populated
    const withVendor = await prisma.squareDailySales.count({
      where: { NOT: { vendorName: null } },
    });

    // 6. Sample of recent sales
    const recentSales = await prisma.squareDailySales.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      select: { date: true, itemName: true, quantitySold: true, vendorName: true, category: true },
    });

    // 7. Check all vendors
    const allVendors = await prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // 8. Check September data (6mo sync should include this)
    const septemberSales = await prisma.squareDailySales.count({
      where: {
        date: {
          gte: new Date('2025-09-01'),
          lt: new Date('2025-10-01'),
        },
      },
    });

    // 9. Check August data (6mo = 26 weeks back from now)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 26 * 7);
    const oldestExpected = sixMonthsAgo.toISOString().split('T')[0];

    return NextResponse.json({
      salesData: {
        totalRecords: salesCount,
        dateRange: {
          oldest: dateRange._min.date,
          newest: dateRange._max.date,
        },
        oldestExpectedWith6moSync: oldestExpected,
        septemberRecords: septemberSales,
        recordsWithVendor: withVendor,
      },
      vendors: {
        heapsGood: heapsGood ? { id: heapsGood.id, name: heapsGood.name } : null,
        allVendors: allVendors,
      },
      carobItem: {
        inItemsTable: carobItem ? { name: carobItem.name, vendor: carobItem.vendor?.name } : null,
        inSalesData: carobSales.map(s => ({
          date: s.date.toISOString().split('T')[0],
          name: s.itemName,
          qty: s.quantitySold,
          vendor: s.vendorName,
        })),
      },
      recentSales: recentSales.map(s => ({
        date: s.date.toISOString().split('T')[0],
        name: s.itemName?.substring(0, 50),
        qty: s.quantitySold,
        vendor: s.vendorName,
        category: s.category,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
