
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};
    
    const [products, total] = await Promise.all([
      prisma.squareProduct.findMany({
        where,
        include: {
          inventoryRecords: true,
          productLinks: true,
          lineItems: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.squareProduct.count({ where })
    ]);
    
    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching Square products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, sku, price } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    
    // Create product in Square
    const squareProduct = await squareAPI.createProduct(name, description, sku, price);
    
    // Save to our database
    const savedProduct = await prisma.squareProduct.create({
      data: {
        squareId: squareProduct.id!,
        name: squareProduct.item_data?.name || name,
        description: squareProduct.item_data?.description || description,
        sku: squareProduct.item_data?.variations?.[0]?.item_variation_data?.sku || sku,
        category: squareProduct.item_data?.category_id || null,
        price: squareProduct.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount 
          ? squareProduct.item_data.variations[0].item_variation_data!.price_money!.amount / 100 
          : price,
        currency: 'AUD',
        isActive: true,
        lastSyncedAt: new Date()
      }
    });
    
    return NextResponse.json({ success: true, product: savedProduct });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
