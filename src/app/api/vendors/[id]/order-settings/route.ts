import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'

const VendorOrderSettingsSchema = z.object({
  orderFrequency: z.string().optional(),
  minimumOrderValue: z.number().optional(),
  freeShippingThreshold: z.number().optional(),
  shippingCost: z.number().optional(),
  leadTimeDays: z.number().int().optional(),
  orderDay: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: vendorId } = params

    const orderSettings = await prisma.vendorOrderSettings.findUnique({
      where: { vendorId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!orderSettings) {
      // Return default empty settings if none exist
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, name: true }
      })

      if (!vendor) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        vendorId,
        vendor,
        orderFrequency: null,
        minimumOrderValue: null,
        freeShippingThreshold: null,
        shippingCost: null,
        leadTimeDays: 7,
        orderDay: null,
        contactEmail: null,
        contactPhone: null,
        notes: null,
        isActive: true,
      })
    }

    return NextResponse.json(orderSettings)
  } catch (error) {
    console.error('Error fetching vendor order settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendor order settings' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: vendorId } = params
    const body = await request.json()

    const validatedData = VendorOrderSettingsSchema.parse(body)

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

    const orderSettings = await prisma.vendorOrderSettings.upsert({
      where: { vendorId },
      create: {
        vendorId,
        ...validatedData,
      },
      update: validatedData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(orderSettings)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating vendor order settings:', error)
    return NextResponse.json(
      { error: 'Failed to update vendor order settings' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: vendorId } = params

    await prisma.vendorOrderSettings.delete({
      where: { vendorId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor order settings:', error)
    return NextResponse.json(
      { error: 'Failed to delete vendor order settings' },
      { status: 500 }
    )
  }
}