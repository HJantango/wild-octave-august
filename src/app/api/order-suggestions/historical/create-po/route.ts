import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const CreatePOFromHistoricalSchema = z.object({
  vendorId: z.string(),
  selectedItems: z.array(z.object({
    itemName: z.string(),
    quantity: z.number().positive(),
    unitCostExGst: z.number().positive(),
    notes: z.string().optional(),
  })).min(1),
  expectedDeliveryDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, selectedItems, expectedDeliveryDate, notes, createdBy } = 
      CreatePOFromHistoricalSchema.parse(body)

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        orderSettings: true
      }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // Generate order number
    const orderCount = await prisma.purchaseOrder.count()
    const orderNumber = `PO-${String(orderCount + 1).padStart(6, '0')}`

    // Prepare line items and calculate totals
    const lineItems = selectedItems.map(item => {
      const totalCostExGst = new Decimal(item.quantity).mul(new Decimal(item.unitCostExGst))
      
      return {
        name: item.itemName,
        quantity: new Decimal(item.quantity),
        unitCostExGst: new Decimal(item.unitCostExGst),
        totalCostExGst,
        notes: item.notes,
      }
    })

    // Calculate totals
    const subtotalExGst = lineItems.reduce((sum, item) => sum.add(item.totalCostExGst), new Decimal(0))
    
    // Get vendor settings for shipping
    const vendorSettings = vendor.orderSettings
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
            error: `Order value $${subtotalExGst.toFixed(2)} is below minimum order value of $${minimumOrder.toFixed(2)} for ${vendor.name}`,
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
          notes: notes ? `${notes}\n\n📊 Generated from historical invoice analysis` : '📊 Generated from historical invoice analysis',
          createdBy,
        }
      })

      // Create line items
      await tx.purchaseOrderLineItem.createMany({
        data: lineItems.map(item => ({
          purchaseOrderId: purchaseOrder.id,
          itemId: null, // Historical suggestions don't have specific item IDs
          name: item.name,
          quantity: item.quantity,
          unitCostExGst: item.unitCostExGst,
          totalCostExGst: item.totalCostExGst,
          notes: item.notes,
        }))
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
        lineItems: true
      }
    })

    console.log(`✅ Created PO ${orderNumber} from historical analysis with ${selectedItems.length} items`)

    return NextResponse.json({
      purchaseOrder: completePurchaseOrder,
      orderSummary: {
        subtotalExGst: subtotalExGst.toNumber(),
        shippingCost: shippingCost.toNumber(),
        gstAmount: gstAmount.toNumber(),
        totalIncGst: totalIncGst.toNumber(),
        itemCount: lineItems.length,
        source: 'historical_analysis'
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating purchase order from historical analysis:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}