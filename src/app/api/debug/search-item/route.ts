import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('q') || 'ACC';
  
  try {
    // Search in sales data
    const salesMatches = await prisma.squareDailySales.findMany({
      where: { itemName: { contains: search, mode: 'insensitive' } },
      orderBy: { date: 'desc' },
      take: 20,
    });

    // Search in items table
    const itemMatches = await prisma.item.findMany({
      where: { name: { contains: search, mode: 'insensitive' } },
      include: { vendor: true },
      take: 20,
    });

    // Search vendors
    const vendorMatches = await prisma.vendor.findMany({
      where: { name: { contains: search, mode: 'insensitive' } },
    });

    return NextResponse.json({
      search,
      salesMatches: salesMatches.map(s => ({
        date: s.date.toISOString().split('T')[0],
        name: s.itemName,
        qty: s.quantitySold,
        vendor: s.vendorName,
      })),
      itemMatches: itemMatches.map(i => ({
        name: i.name,
        vendor: i.vendor?.name,
        sku: i.sku,
      })),
      vendorMatches,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
