import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { squareAPI } from '@/lib/square-api'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const unlinkedOnly = searchParams.get('unlinkedOnly') === 'true'

    if (unlinkedOnly) {
      // Get unlinked products from invoices
      const unlinkedProducts = await db.lineItem.findMany({
        where: {
          squareProductId: null
        },
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          invoice: {
            select: {
              vendor: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        distinct: ['productName']
      })

      return NextResponse.json({ 
        unlinkedProducts: unlinkedProducts.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          invoice: item.invoice
        }))
      })
    }

    // Get all product links
    const productLinks = await db.productLink.findMany({
      include: {
        squareProduct: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ productLinks })
  } catch (error) {
    console.error('Error fetching product links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product links' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceProductName, squareProductId, isManualLink = true, linkedBy } = await request.json()

    if (!invoiceProductName || !squareProductId) {
      return NextResponse.json(
        { error: 'Invoice product name and Square product ID are required' },
        { status: 400 }
      )
    }

    // Check if Square product exists
    const squareProduct = await db.squareProduct.findUnique({
      where: { id: squareProductId }
    })

    if (!squareProduct) {
      return NextResponse.json(
        { error: 'Square product not found' },
        { status: 404 }
      )
    }

    // Create or update product link
    const productLink = await db.productLink.upsert({
      where: {
        invoiceProductName_squareProductId: {
          invoiceProductName,
          squareProductId
        }
      },
      update: {
        confidence: 1.0, // Manual links get full confidence
        isManualLink,
        linkedBy: linkedBy || 'user'
      },
      create: {
        invoiceProductName,
        squareProductId,
        confidence: isManualLink ? 1.0 : 0.8,
        isManualLink,
        linkedBy: linkedBy || 'user'
      },
      include: {
        squareProduct: true
      }
    })

    // Update line items to link them to the Square product
    await db.lineItem.updateMany({
      where: {
        productName: invoiceProductName,
        squareProductId: null
      },
      data: {
        squareProductId
      }
    })

    return NextResponse.json({ productLink })
  } catch (error) {
    console.error('Error creating product link:', error)
    return NextResponse.json(
      { error: 'Failed to create product link' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('id')

    if (!linkId) {
      return NextResponse.json(
        { error: 'Link ID is required' },
        { status: 400 }
      )
    }

    // Get the product link to find associated line items
    const productLink = await db.productLink.findUnique({
      where: { id: linkId }
    })

    if (!productLink) {
      return NextResponse.json(
        { error: 'Product link not found' },
        { status: 404 }
      )
    }

    // Remove the link from line items
    await db.lineItem.updateMany({
      where: {
        productName: productLink.invoiceProductName,
        squareProductId: productLink.squareProductId
      },
      data: {
        squareProductId: null
      }
    })

    // Delete the product link
    await db.productLink.delete({
      where: { id: linkId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product link:', error)
    return NextResponse.json(
      { error: 'Failed to delete product link' },
      { status: 500 }
    )
  }
}
