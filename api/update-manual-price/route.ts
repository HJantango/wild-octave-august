

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = "force-dynamic"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { lineItemId, manualUnitPrice } = await request.json()

    if (!lineItemId || manualUnitPrice === undefined) {
      return NextResponse.json(
        { error: 'Line item ID and manual unit price are required' },
        { status: 400 }
      )
    }

    // Get line item to recalculate prices
    const lineItem = await prisma.lineItem.findUnique({
      where: { id: lineItemId },
      include: { category: true }
    })

    if (!lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }

    // Calculate new prices if item has a category
    let finalPrice = null
    let gstAmount = null
    let finalPriceIncGst = null

    if (lineItem.category) {
      // Use custom markup if available, otherwise use category markup
      const effectiveMarkup = lineItem.customMarkup ?? lineItem.category.markup
      
      // Calculate final price with markup
      finalPrice = manualUnitPrice * effectiveMarkup
      
      // Calculate GST amount and final price including GST
      gstAmount = lineItem.gstApplicable ? finalPrice * 0.10 : 0
      finalPriceIncGst = finalPrice + gstAmount
    }

    const updatedLineItem = await prisma.lineItem.update({
      where: { id: lineItemId },
      data: {
        manualUnitPrice: manualUnitPrice,
        finalPrice: finalPrice,
        gstAmount: gstAmount,
        finalPriceIncGst: finalPriceIncGst
      },
      include: {
        category: true,
        product: true
      }
    })

    return NextResponse.json(updatedLineItem)
  } catch (error) {
    console.error('Error updating manual price:', error)
    return NextResponse.json(
      { error: 'Failed to update manual price' },
      { status: 500 }
    )
  }
}
