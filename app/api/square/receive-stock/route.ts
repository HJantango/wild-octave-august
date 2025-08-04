import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { productId, quantity, notes } = await request.json();

    if (!productId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Product ID and quantity are required' },
        { status: 400 }
      );
    }

    // Find the product
    const product = await db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update the product's stock quantity
    const updatedProduct = await db.product.update({
      where: { id: productId },
      data: {
        stockQuantity: {
          increment: quantity
        },
        stockReceived: true,
        stockReceivedAt: new Date(),
        notes: notes || product.notes
      }
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      message: `Successfully received ${quantity} units of ${product.name}`
    });

  } catch (error) {
    console.error('Error receiving stock:', error);
    return NextResponse.json(
      { error: 'Failed to receive stock' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get all products that have received stock recently
    const recentlyReceivedStock = await db.product.findMany({
      where: {
        stockReceived: true,
        stockReceivedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: {
        stockReceivedAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      products: recentlyReceivedStock
    });

  } catch (error) {
    console.error('Error fetching received stock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch received stock' },
      { status: 500 }
    );
  }
}
