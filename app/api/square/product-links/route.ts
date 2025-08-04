
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unlinkedOnly = searchParams.get('unlinkedOnly') === 'true';
    
    if (unlinkedOnly) {
      // Get invoice products that don't have Square links
      const unlinkedProducts = await prisma.lineItem.findMany({
        where: {
          squareProductId: null,
          needsClarification: false
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
        distinct: ['productName'],
        orderBy: { productName: 'asc' }
      });
      
      return NextResponse.json({ unlinkedProducts });
    }
    
    // Get all product links
    const productLinks = await prisma.productLink.findMany({
      include: {
        squareProduct: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ productLinks });
  } catch (error) {
    console.error('Error fetching product links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product links' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceProductName, squareProductId, isManualLink = true, linkedBy } = await request.json();
    
    if (!invoiceProductName || !squareProductId) {
      return NextResponse.json({ error: 'Product name and Square product ID are required' }, { status: 400 });
    }
    
    // Check if link already exists
    const existingLink = await prisma.productLink.findUnique({
      where: {
        invoiceProductName_squareProductId: {
          invoiceProductName,
          squareProductId
        }
      }
    });
    
    if (existingLink) {
      return NextResponse.json({ error: 'Product link already exists' }, { status: 409 });
    }
    
    // Create the product link
    const productLink = await prisma.productLink.create({
      data: {
        invoiceProductName,
        squareProductId,
        confidence: isManualLink ? 1.0 : 0.0,
        isManualLink,
        linkedBy
      }
    });
    
    // Update all line items with this product name
    await prisma.lineItem.updateMany({
      where: {
        productName: invoiceProductName,
        squareProductId: null
      },
      data: {
        squareProductId: squareProductId
      }
    });
    
    return NextResponse.json({ success: true, productLink });
  } catch (error) {
    console.error('Error creating product link:', error);
    return NextResponse.json(
      { error: 'Failed to create product link', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('id');
    
    if (!linkId) {
      return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
    }
    
    // Get the link first
    const productLink = await prisma.productLink.findUnique({
      where: { id: linkId }
    });
    
    if (!productLink) {
      return NextResponse.json({ error: 'Product link not found' }, { status: 404 });
    }
    
    // Remove the link
    await prisma.productLink.delete({
      where: { id: linkId }
    });
    
    // Update line items to remove the Square product association
    await prisma.lineItem.updateMany({
      where: {
        productName: productLink.invoiceProductName,
        squareProductId: productLink.squareProductId
      },
      data: {
        squareProductId: null
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product link:', error);
    return NextResponse.json(
      { error: 'Failed to delete product link' },
      { status: 500 }
    );
  }
}
