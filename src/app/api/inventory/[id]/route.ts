import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'

const InventoryUpdateSchema = z.object({
  currentStock: z.number().optional(),
  minimumStock: z.number().optional(),
  maximumStock: z.number().optional(),
  reorderPoint: z.number().optional(),
  packSize: z.number().int().optional(),
  minimumOrderQuantity: z.number().optional(),
  notes: z.string().optional(),
})

const StockAdjustmentSchema = z.object({
  quantity: z.number(),
  movementType: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id },
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
          take: 20
        }
      }
    })

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(inventoryItem)
  } catch (error) {
    console.error('Error fetching inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory item' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const validatedData = InventoryUpdateSchema.parse(body)

    const inventoryItem = await prisma.inventoryItem.update({
      where: { id },
      data: validatedData,
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
        }
      }
    })

    return NextResponse.json(inventoryItem)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    )
  }
}