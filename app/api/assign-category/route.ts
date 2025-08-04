
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = "force-dynamic"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { lineItemId, lineItemIds, categoryId, customMarkup, manualUnitPrice } = await request.json()

    // Handle bulk assignment
    if (lineItemIds && Array.isArray(lineItemIds)) {
      if (!categoryId) {
        return NextResponse.json(
          { error: 'Category ID is required for bulk assignment' },
          { status: 400 }
        )
      }

      // Get category to calculate final price
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      })

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        )
      }

      // Update multiple line items
      const updatedLineItems = []
      for (const itemId of lineItemIds) {
        const lineItem = await prisma.lineItem.findUnique({
          where: { id: itemId },
          include: { product: true }
        })

        if (!lineItem) {
          continue // Skip items that don't exist
        }

        // Use manual price if provided, otherwise use original unit price
        const effectiveUnitPrice = manualUnitPrice ?? lineItem.manualUnitPrice ?? lineItem.unitPrice
        
        // Use custom markup if provided, otherwise use category markup
        const effectiveMarkup = customMarkup ?? lineItem.customMarkup ?? category.markup
        
        // Calculate final price with markup
        const finalPrice = effectiveUnitPrice * effectiveMarkup
        
        // Calculate GST amount and final price including GST
        const gstAmount = lineItem.gstApplicable ? finalPrice * 0.10 : 0
        const finalPriceIncGst = finalPrice + gstAmount

        const updatedLineItem = await prisma.lineItem.update({
          where: { id: itemId },
          data: {
            categoryId: categoryId,
            customMarkup: customMarkup || lineItem.customMarkup,
            manualUnitPrice: manualUnitPrice || lineItem.manualUnitPrice,
            finalPrice: finalPrice,
            gstAmount: gstAmount,
            finalPriceIncGst: finalPriceIncGst
          },
          include: {
            category: true,
            product: true
          }
        })

        // Save product-category mapping for future use
        if (lineItem.productId) {
          await prisma.productCategoryMapping.upsert({
            where: { productId: lineItem.productId },
            update: { categoryId: categoryId },
            create: {
              productId: lineItem.productId,
              categoryId: categoryId
            }
          })
        }

        updatedLineItems.push(updatedLineItem)
      }

      return NextResponse.json(updatedLineItems)
    }

    // Handle single item assignment
    if (!lineItemId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    // Handle custom markup case (categoryId can be null)
    if (!categoryId && !customMarkup) {
      return NextResponse.json(
        { error: 'Either category ID or custom markup is required' },
        { status: 400 }
      )
    }

    // Get category to calculate final price (only if categoryId is provided)
    let category = null
    if (categoryId) {
      category = await prisma.category.findUnique({
        where: { id: categoryId }
      })

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        )
      }
    }

    // Update line item with category and calculate final price
    const lineItem = await prisma.lineItem.findUnique({
      where: { id: lineItemId },
      include: { product: true }
    })

    if (!lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }

    // Use manual price if provided, otherwise use original unit price
    const effectiveUnitPrice = manualUnitPrice ?? lineItem.manualUnitPrice ?? lineItem.unitPrice
    
    // Use custom markup if provided, otherwise use category markup, default to 1 if no category
    const effectiveMarkup = customMarkup ?? lineItem.customMarkup ?? category?.markup ?? 1
    
    // Calculate final price with markup
    const finalPrice = effectiveUnitPrice * effectiveMarkup
    
    // Calculate GST amount and final price including GST
    const gstAmount = lineItem.gstApplicable ? finalPrice * 0.10 : 0
    const finalPriceIncGst = finalPrice + gstAmount

    const updatedLineItem = await prisma.lineItem.update({
      where: { id: lineItemId },
      data: {
        categoryId: categoryId || null,
        customMarkup: customMarkup || lineItem.customMarkup,
        manualUnitPrice: manualUnitPrice || lineItem.manualUnitPrice,
        finalPrice: finalPrice,
        gstAmount: gstAmount,
        finalPriceIncGst: finalPriceIncGst
      },
      include: {
        category: true,
        product: true
      }
    })

    // Save product-category mapping for future use (only if we have both productId and categoryId)
    if (lineItem.productId && categoryId) {
      await prisma.productCategoryMapping.upsert({
        where: { productId: lineItem.productId },
        update: { categoryId: categoryId },
        create: {
          productId: lineItem.productId,
          categoryId: categoryId
        }
      })
    }

    return NextResponse.json(updatedLineItem)
  } catch (error) {
    console.error('Error assigning category:', error)
    return NextResponse.json(
      { error: 'Failed to assign category' },
      { status: 500 }
    )
  }
}
