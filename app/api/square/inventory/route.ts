import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Get inventory records with product information
    const inventory = await db.squareInventory.findMany({
      include: {
        squareProduct: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    })

    return NextResponse.json({ inventory })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { squareProductId, quantity, action = 'set' } = await request.json()

    if (!squareProductId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Square product ID and quantity are required' },
        { status: 400 }
      )
    }

    // Get the Square product
    const squareProduct = await db.squareProduct.findUnique({
      where: { id: squareProductId }
    })

    if (!squareProduct) {
      return NextResponse.json(
        { error: 'Square product not found' },
        { status: 404 }
      )
    }

    const defaultLocationId = 'default_location'

    // Get or create inventory record
    let inventoryRecord = await db.squareInventory.findFirst({
      where: {
        squareProductId,
        locationId: defaultLocationId
      }
    })

    let newQuantity = quantity
    if (action === 'adjust' && inventoryRecord) {
      newQuantity = inventoryRecord.quantity + quantity
    }

    if (inventoryRecord) {
      // Update existing inventory
      inventoryRecord = await db.squareInventory.update({
        where: { id: inventoryRecord.id },
        data: {
          quantity: Math.max(0, newQuantity), // Ensure quantity doesn't go negative
          lastUpdated: new Date()
        }
      })
    } else {
      // Create new inventory record
      inventoryRecord = await db.squareInventory.create({
        data: {
          squareProductId,
          locationId: defaultLocationId,
          quantity: Math.max(0, newQuantity),
          lastUpdated: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      inventory: inventoryRecord,
      message: `Inventory updated: ${newQuantity} units`
    })

  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    )
  }
}
