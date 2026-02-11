import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || 'heaps';
  
  try {
    // Simple vendor lookup
    const vendors = await prisma.vendor.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    // Count items per vendor
    const vendorIds = vendors.map(v => v.id);
    const itemCounts = await prisma.item.groupBy({
      by: ['vendorId'],
      where: { vendorId: { in: vendorIds } },
      _count: true,
    });

    // Get sample items
    const sampleItems = await prisma.item.findMany({
      where: { vendorId: { in: vendorIds } },
      select: { name: true, vendorId: true },
      take: 20,
    });

    // Check sales data
    const salesCheck = await prisma.squareDailySales.findMany({
      where: { 
        OR: [
          { vendorName: { contains: q, mode: 'insensitive' } },
          { itemName: { contains: q, mode: 'insensitive' } },
        ]
      },
      select: { itemName: true, vendorName: true, date: true },
      take: 20,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      query: q,
      vendors,
      itemCounts: itemCounts.map(ic => ({ vendorId: ic.vendorId, count: ic._count })),
      sampleItems,
      salesRecords: salesCheck,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 });
  }
}
