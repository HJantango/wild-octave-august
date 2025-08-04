
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const squareProductId = searchParams.get('squareProductId');
    
    if (squareProductId) {
      // Get inventory for specific product
      const inventory = await prisma.squareInventory.findMany({
        where: { squareProductId },
        include: {
          squareProduct: true
        }
      });
      
      return NextResponse.json({ inventory });
    }
    
    // Get all inventory with low stock alerts
    const inventory = await prisma.squareInventory.findMany({
      include: {
        squareProduct: true
      },
      orderBy: { quantity: 'asc' }
    });
    
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { squareProductId, quantity, locationId, action = 'set' } = await request.json();
    
    if (!squareProductId || quantity === undefined) {
      return NextResponse.json({ error: 'Product ID and quantity are required' }, { status: 400 });
    }
    
    // Get the Square product
    const squareProduct = await prisma.squareProduct.findUnique({
      where: { id: squareProductId }
    });
    
    if (!squareProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Update inventory in Square
    if (action === 'set') {
      await squareAPI.updateInventoryCount(squareProduct.squareId, quantity, locationId);
    } else if (action === 'adjust') {
      await squareAPI.adjustInventoryCount(squareProduct.squareId, quantity, locationId);
    }
    
    // Update our database
    const defaultLocation = await squareAPI.getDefaultLocation();
    const finalLocationId = locationId || defaultLocation.id!;
    
    const currentInventory = await prisma.squareInventory.findUnique({
      where: {
        squareProductId_locationId: {
          squareProductId: squareProductId,
          locationId: finalLocationId
        }
      }
    });
    
    let newQuantity = quantity;
    if (action === 'adjust' && currentInventory) {
      newQuantity = currentInventory.quantity + quantity;
    }
    
    const updatedInventory = await prisma.squareInventory.upsert({
      where: {
        squareProductId_locationId: {
          squareProductId: squareProductId,
          locationId: finalLocationId
        }
      },
      update: {
        quantity: newQuantity,
        lastUpdated: new Date()
      },
      create: {
        squareProductId: squareProductId,
        locationId: finalLocationId,
        quantity: newQuantity,
        lastUpdated: new Date()
      }
    });
    
    return NextResponse.json({ success: true, inventory: updatedInventory });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
