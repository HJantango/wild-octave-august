import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Check categories in items table
    const itemCategories = await prisma.item.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: { category: 'desc' } },
    });

    // Check categories in sales data
    const salesCategories = await prisma.squareDailySales.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: { category: 'desc' } },
    });

    // Sample of cafe-looking items by name
    const cafeItems = await prisma.squareDailySales.findMany({
      where: {
        OR: [
          { itemName: { contains: 'cafe', mode: 'insensitive' } },
          { itemName: { contains: 'coffee', mode: 'insensitive' } },
          { itemName: { contains: 'latte', mode: 'insensitive' } },
          { itemName: { contains: 'chai', mode: 'insensitive' } },
          { itemName: { contains: 'smoothie', mode: 'insensitive' } },
          { itemName: { contains: 'juice', mode: 'insensitive' } },
          { itemName: { contains: 'pie', mode: 'insensitive' } },
          { itemName: { contains: 'cake', mode: 'insensitive' } },
          { itemName: { contains: 'salad', mode: 'insensitive' } },
          { itemName: { contains: 'sandwich', mode: 'insensitive' } },
          { itemName: { contains: 'toast', mode: 'insensitive' } },
          { itemName: { contains: 'wrap', mode: 'insensitive' } },
        ],
      },
      select: { itemName: true, category: true },
      distinct: ['itemName'],
      take: 50,
    });

    // Get unique item names that look like cafe items
    const uniqueCafeItems = [...new Set(cafeItems.map(i => i.itemName))].sort();

    return NextResponse.json({
      itemCategories: itemCategories.map(c => ({ category: c.category, count: c._count })),
      salesCategories: salesCategories.map(c => ({ category: c.category, count: c._count })),
      sampleCafeItems: uniqueCafeItems,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
