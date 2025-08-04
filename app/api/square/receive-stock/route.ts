
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { lineItemId } = await request.json();
    
    if (!lineItemId) {
      return NextResponse.json({ error: 'Line item ID is required' }, { status: 400 });
    }
    
    // Get the line item with Square product info
    const lineItem = await prisma.lineItem.findUnique({
      where: { id: lineItemId },
      include: {
        squareProduct: {
          include: {
            inventoryRecords: true
          }
        }
      }
    });
    
    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }
    
    if (!lineItem.squareProduct) {
      return NextResponse.json({ error: 'Line item is not linked to a Square product' }, { status: 400 });
    }
    
    if (lineItem.stockReceived) {
      return NextResponse.json({ error: 'Stock already received for this item' }, { status: 400 });
    }
    
    // Update Square inventory
    await squareAPI.adjustInventoryCount(
      lineItem.squareProduct.squareId,
      lineItem.quantity
    );
    
    // Update our database
    const defaultLocation = await squareAPI.getDefaultLocation();
    const locationId = defaultLocation.id!;
    
    const currentInventory = await prisma.squareInventory.findUnique({
      where: {
        squareProductId_locationId: {
          squareProductId: lineItem.squareProduct.id,
          locationId: locationId
        }
      }
    });
    
    const newQuantity = (currentInventory?.quantity || 0) + lineItem.quantity;
    
    await prisma.squareInventory.upsert({
      where: {
        squareProductId_locationId: {
          squareProductId: lineItem.squareProduct.id,
          locationId: locationId
        }
      },
      update: {
        quantity: newQuantity,
        lastUpdated: new Date()
      },
      create: {
        squareProductId: lineItem.squareProduct.id,
        locationId: locationId,
        quantity: newQuantity,
        lastUpdated: new Date()
      }
    });
    
    // Mark the line item as stock received
    const updatedLineItem = await prisma.lineItem.update({
      where: { id: lineItemId },
      data: {
        stockReceived: true,
        stockReceivedAt: new Date()
      },
      include: {
        squareProduct: {
          include: {
            inventoryRecords: true
          }
        }
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      lineItem: updatedLineItem,
      newInventoryQuantity: newQuantity
    });
  } catch (error) {
    console.error('Error receiving stock:', error);
    return NextResponse.json(
      { error: 'Failed to receive stock', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
