import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const vendorName = request.nextUrl.searchParams.get('name') || 'heaps';
  
  try {
    // Find vendors matching the name
    const vendors = await prisma.vendor.findMany({
      where: { name: { contains: vendorName, mode: 'insensitive' } },
      include: {
        items: {
          select: { id: true, name: true },
          take: 20,
        },
        _count: { select: { items: true } },
      },
    });

    // Check sales data for this vendor
    const salesWithVendor = await prisma.squareDailySales.findMany({
      where: { vendorName: { contains: vendorName, mode: 'insensitive' } },
      take: 10,
      orderBy: { date: 'desc' },
      select: { itemName: true, vendorName: true, date: true, quantitySold: true },
    });

    // Check if there are items in sales that SHOULD match but don't have vendor
    const vendorItemNames = vendors.flatMap(v => v.items.map(i => i.name.toLowerCase()));
    const salesWithoutVendor = await prisma.squareDailySales.findMany({
      where: { vendorName: null },
      take: 100,
      select: { itemName: true, date: true },
      distinct: ['itemName'],
    });

    // Find potential matches
    const potentialMatches = salesWithoutVendor.filter(s => 
      vendorItemNames.some(name => 
        s.itemName.toLowerCase().includes(name) || name.includes(s.itemName.toLowerCase())
      )
    );

    return NextResponse.json({
      vendors: vendors.map(v => ({
        id: v.id,
        name: v.name,
        itemCount: v._count.items,
        sampleItems: v.items.map(i => i.name),
      })),
      salesRecordsWithVendor: salesWithVendor,
      potentialMismatches: potentialMatches.map(p => p.itemName).slice(0, 20),
      totalSalesWithoutVendor: salesWithoutVendor.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
