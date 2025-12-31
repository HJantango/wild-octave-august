import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const CreatePOFromSuggestionsSchema = z.object({
  suggestionIds: z.array(z.string()).min(1),
  adjustments: z.record(z.string(), z.number()).optional(), // suggestionId -> adjusted quantity
  expectedDeliveryDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const { vendorId } = params
    const body = await request.json()
    const { suggestionIds, adjustments = {}, expectedDeliveryDate, notes, createdBy } = 
      CreatePOFromSuggestionsSchema.parse(body)

    // Fetch suggestions with related data
    const suggestions = await prisma.orderSuggestion.findMany({
      where: {
        id: { in: suggestionIds },
        vendorId,
        isActive: true,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            orderSettings: true,
          }
        },
        inventoryItem: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                currentCostExGst: true,
                category: true,
              }
            }
          }
        }
      }
    })

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'No valid suggestions found' },
        { status: 404 }
      )
    }

    if (suggestions.some(s => s.vendorId !== vendorId)) {
      return NextResponse.json(
        { error: 'All suggestions must be for the same vendor' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderCount = await prisma.purchaseOrder.count()
    const orderNumber = `PO-${String(orderCount + 1).padStart(6, '0')}`

    // Prepare line items
    const lineItems = suggestions.map(suggestion => {
      const adjustedQuantity = adjustments[suggestion.id] || suggestion.suggestedQuantity.toNumber()
      const unitCost = suggestion.inventoryItem.item.currentCostExGst
      const totalCost = new Decimal(adjustedQuantity).mul(unitCost)

      return {
        suggestionId: suggestion.id,
        itemId: suggestion.inventoryItem.item.id,
        name: suggestion.inventoryItem.item.name,
        quantity: new Decimal(adjustedQuantity),
        unitCostExGst: unitCost,
        totalCostExGst: totalCost,
      }
    })

    // Calculate totals
    const subtotalExGst = lineItems.reduce((sum, item) => sum.add(item.totalCostExGst), new Decimal(0))
    
    // Get vendor settings for shipping
    const vendorSettings = suggestions[0].vendor.orderSettings
    let shippingCost = new Decimal(0)
    
    if (vendorSettings) {
      const freeShippingThreshold = vendorSettings.freeShippingThreshold
      const shippingCostSetting = vendorSettings.shippingCost
      
      if (freeShippingThreshold && shippingCostSetting) {
        if (subtotalExGst.lt(freeShippingThreshold)) {
          shippingCost = new Decimal(shippingCostSetting)
        }
      } else if (shippingCostSetting) {
        shippingCost = new Decimal(shippingCostSetting)
      }
    }

    const subtotalWithShipping = subtotalExGst.add(shippingCost)
    const gstAmount = subtotalWithShipping.mul(new Decimal(0.1)) // 10% GST
    const totalIncGst = subtotalWithShipping.add(gstAmount)

    // Check minimum order value
    if (vendorSettings?.minimumOrderValue) {
      const minimumOrder = new Decimal(vendorSettings.minimumOrderValue)
      if (subtotalExGst.lt(minimumOrder)) {
        return NextResponse.json(
          { 
            error: `Order value $${subtotalExGst.toFixed(2)} is below minimum order value of $${minimumOrder.toFixed(2)} for ${suggestions[0].vendor.name}`,
            minimumOrderValue: minimumOrder.toNumber(),
            currentOrderValue: subtotalExGst.toNumber(),
          },
          { status: 400 }
        )
      }
    }

    // Create purchase order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create purchase order
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          vendorId,
          vendorOrderSettingsId: vendorSettings?.id,
          orderNumber,
          expectedDeliveryDate,
          subtotalExGst,
          gstAmount,
          shippingCost,
          totalIncGst,
          notes,
          createdBy,
        }
      })

      // Create line items
      await tx.purchaseOrderLineItem.createMany({
        data: lineItems.map(item => ({
          purchaseOrderId: purchaseOrder.id,
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unitCostExGst: item.unitCostExGst,
          totalCostExGst: item.totalCostExGst,
        }))
      })

      // Mark suggestions as used (deactivate them)
      await tx.orderSuggestion.updateMany({
        where: {
          id: { in: suggestionIds }
        },
        data: {
          isActive: false,
        }
      })

      return purchaseOrder
    })

    // Fetch complete purchase order with relations
    const completePurchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: result.id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          }
        },
        vendorOrderSettings: true,
        lineItems: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true,
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      purchaseOrder: completePurchaseOrder,
      usedSuggestions: suggestions.length,
      orderSummary: {
        subtotalExGst: subtotalExGst.toNumber(),
        shippingCost: shippingCost.toNumber(),
        gstAmount: gstAmount.toNumber(),
        totalIncGst: totalIncGst.toNumber(),
        itemCount: lineItems.length,
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating purchase order from suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}