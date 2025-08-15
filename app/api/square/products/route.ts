import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = "force-dynamic"

// TypeScript interfaces for Square API
interface SquareProduct {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  price?: number;
  isActive: boolean;
}

export async function GET() {
  try {
    // Get products from database
    const products = await db.squareProduct.findMany({
      include: {
        inventoryRecords: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    // For now, return database products without calling Square API
    // In production, you might want to sync with Square API here
    const result = products.map(product => ({
      id: product.id,
      squareId: product.squareId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      price: product.price,
      currency: product.currency,
      isActive: product.isActive,
      squareCreatedAt: product.squareCreatedAt,
      squareUpdatedAt: product.squareUpdatedAt,
      lastSyncedAt: product.lastSyncedAt,
      inventoryRecords: product.inventoryRecords,
    }))

    return NextResponse.json({ products: result })
  } catch (error) {
    console.error('Error fetching Square products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Square products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, sku, price } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    // Create product in database
    // In production, you'd also create it in Square API
    const product = await db.squareProduct.create({
      data: {
        squareId: `temp_${Date.now()}`, // Temporary ID until Square sync
        name,
        description,
        sku,
        price: price ? parseFloat(price) : undefined,
        currency: 'AUD',
        isActive: true,
        lastSyncedAt: new Date(),
      },
      include: {
        inventoryRecords: true,
      }
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error creating Square product:', error)
    return NextResponse.json(
      { error: 'Failed to create Square product' },
      { status: 500 }
    )
  }
}
