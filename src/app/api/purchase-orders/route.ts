import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const PurchaseOrderQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  status: z.string().optional(),
  vendorId: z.string().optional(),
  search: z.string().optional(),
})

const PurchaseOrderLineItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string(),
  quantity: z.number().positive(),
  unitCostExGst: z.number().positive(),
  notes: z.string().optional(),
})

const CreatePurchaseOrderSchema = z.object({
  vendorId: z.string(),
  expectedDeliveryDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  lineItems: z.array(PurchaseOrderLineItemSchema),
  createdBy: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = PurchaseOrderQuerySchema.parse(Object.fromEntries(searchParams))
    
    const { page, limit, status, vendorId, search } = query
    const skip = (page - 1) * limit

    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (vendorId) {
      where.vendorId = vendorId
    }
    
    if (search) {
      where.OR = [
        {
          orderNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          vendor: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    const [purchaseOrders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            }
          },
          lineItems: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  sku: true,
                }
              }
            }
          },
          linkedInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.purchaseOrder.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      purchaseOrders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreatePurchaseOrderSchema.parse(body)
    
    const { vendorId, expectedDeliveryDate, notes, lineItems, createdBy } = validatedData

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // Generate order number by finding the latest order number and incrementing
    const latestOrder = await prisma.purchaseOrder.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true }
    })

    let nextOrderNum = 1
    if (latestOrder?.orderNumber) {
      // Extract numeric portion from "PO-000123" format
      const match = latestOrder.orderNumber.match(/PO-(\d+)/)
      if (match) {
        nextOrderNum = parseInt(match[1]) + 1
      }
    }

    const orderNumber = `PO-${String(nextOrderNum).padStart(6, '0')}`

    // Calculate totals
    let subtotalExGst = new Decimal(0)
    
    const processedLineItems = lineItems.map(item => {
      const totalCostExGst = new Decimal(item.quantity).mul(new Decimal(item.unitCostExGst))
      subtotalExGst = subtotalExGst.add(totalCostExGst)
      
      return {
        ...item,
        totalCostExGst,
      }
    })

    const gstAmount = subtotalExGst.mul(new Decimal(0.1)) // 10% GST
    const totalIncGst = subtotalExGst.add(gstAmount)

    // Create purchase order with line items
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          vendorId,
          orderNumber,
          expectedDeliveryDate,
          notes,
          subtotalExGst,
          gstAmount,
          totalIncGst,
          createdBy,
        }
      })

      // Create line items
      await tx.purchaseOrderLineItem.createMany({
        data: processedLineItems.map(item => ({
          purchaseOrderId: po.id,
          itemId: item.itemId,
          name: item.name,
          quantity: new Decimal(item.quantity),
          unitCostExGst: new Decimal(item.unitCostExGst),
          totalCostExGst: item.totalCostExGst,
          notes: item.notes,
        }))
      })

      return po
    })

    // Fetch complete purchase order with relations
    const completePurchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrder.id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          }
        },
        lineItems: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true,
                sku: true,
              }
            }
          }
        }
      }
    })

    return NextResponse.json(completePurchaseOrder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}