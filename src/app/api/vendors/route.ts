import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'

const CreateVendorSchema = z.object({
  name: z.string().min(1),
  contactInfo: z.any().optional(),
  paymentTerms: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        contactInfo: true,
        paymentTerms: true,
        createdAt: true,
        updatedAt: true,
        orderSettings: true,
        _count: {
          select: {
            items: true,
            invoices: true,
            purchaseOrders: true,
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(vendors)
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateVendorSchema.parse(body)

    // Check if vendor already exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { name: validatedData.name }
    })

    if (existingVendor) {
      return NextResponse.json(existingVendor)
    }

    // Create new vendor
    const vendor = await prisma.vendor.create({
      data: {
        name: validatedData.name,
        contactInfo: validatedData.contactInfo || {},
        paymentTerms: validatedData.paymentTerms,
      }
    })

    return NextResponse.json(vendor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating vendor:', error)
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    )
  }
}