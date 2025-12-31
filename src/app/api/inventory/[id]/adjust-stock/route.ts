import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const StockAdjustmentSchema = z.object({
  quantity: z.number(),
  movementType: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  reason: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const validatedData = StockAdjustmentSchema.parse(body)
    const { quantity, movementType, reason, notes, createdBy } = validatedData

    // Get current inventory item
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        item: {
          select: { name: true }
        }
      }
    })

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    // Calculate new stock level
    let newStock = inventoryItem.currentStock.toNumber()
    
    switch (movementType) {
      case 'IN':
        newStock += quantity
        break
      case 'OUT':
        newStock -= quantity
        break
      case 'ADJUSTMENT':
        // For adjustments, quantity is the new stock level
        newStock = quantity
        break
    }

    if (newStock < 0) {
      return NextResponse.json(
        { error: 'Stock adjustment would result in negative stock' },
        { status: 400 }
      )
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create stock movement record
      const stockMovement = await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          movementType,
          quantity: new Decimal(Math.abs(quantity)),
          reason,
          notes,
          createdBy,
        }
      })

      // Update current stock
      const updatedInventoryItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          currentStock: new Decimal(newStock),
          updatedAt: new Date(),
        },
        include: {
          item: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          stockMovements: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      })

      return { stockMovement, inventoryItem: updatedInventoryItem }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    )
  }
}