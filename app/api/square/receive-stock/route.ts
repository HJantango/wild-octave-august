import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { lineItemId } = await request.json()

    if (!lineItemId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    // Get the line item with its linked Square product
    const lineItem = await db.lineItem.findUnique({
      where: { id: lineItemId },
      include: {
        squareProduct: {
          include: {
            inventoryRecords: true
          }
        }
      }
    })

    if (!lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }

    if (!lineItem.squareProductId) {
      return NextResponse.json(
        { error: 'Line item is not linked to a Square product' },
        { status: 400 }
      )
    }

    if (lineItem.stockReceived) {
      return NextResponse.json(
        { error: 'Stock already received for this item' },
        { status: 400 }
      )
    }

    // Update the line item to mark stock as received
    const updatedLineItem = await db.lineItem.update({
      where: { id: lineItemId },
      data: {
        stockReceived: true,
        stockReceivedAt: new Date()
      }
    })

    // Update inventory in Square (if integration is available)
    try {
      // Get or create inventory record for the default location
      const defaultLocationId = 'default_location' // You'd get this from Square API
      
      let inventoryRecord = await db.squareInventory.findFirst({
        where: {
          squareProductId: lineItem.squareProductId,
          locationId: defaultLocationId
        }
      })

      if (inventoryRecord) {
        // Update existing inventory
        await db.squareInventory.update({
          where: { id: inventoryRecord.id },
          data: {
            quantity: inventoryRecord.quantity + lineItem.quantity,
            lastUpdated: new Date()
          }
        })
      } else {
        // Create new inventory record
        await db.squareInventory.create({
          data: {
            squareProductId: lineItem.squareProductId,
            locationId: defaultLocationId,
            quantity: lineItem.quantity,
            lastUpdated: new Date()
          }
        })
      }

      // In production, you'd also update Square API inventory here
      console.log(`Stock received: ${lineItem.quantity} units of ${lineItem.productName}`)

    } catch (inventoryError) {
      console.error('Error updating inventory:', inventoryError)
      // Continue even if inventory update fails
    }

    return NextResponse.json({
      success: true,
      lineItem: updatedLineItem,
      message: `Stock received: ${lineItem.quantity} units of ${lineItem.productName}`
    })

  } catch (error) {
    console.error('Error receiving stock:', error)
    return NextResponse.json(
      { error: 'Failed to receive stock' },
      { status: 500 }
    )
  }
}
