
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = "force-dynamic"

const prisma = new PrismaClient()

export async function GET() {
  try {
    console.log('Fetching invoices...')
    
    const invoices = await prisma.invoice.findMany({
      include: {
        vendor: true,
        lineItems: {
          include: {
            product: true,
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Limit to 5 most recent invoices to avoid timeout
    })

    console.log(`Found ${invoices.length} invoices`)
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
