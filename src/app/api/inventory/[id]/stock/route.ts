import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import Decimal from 'decimal.js';

// PUT /api/inventory/[id]/stock - Update inventory stock level
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { currentStock } = body;

    if (currentStock === undefined || currentStock === null) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'currentStock is required',
        400
      );
    }

    const stockValue = new Decimal(currentStock);

    if (stockValue.isNegative()) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Stock cannot be negative',
        400
      );
    }

    // Find the item
    const item = await prisma.item.findUnique({
      where: { id: params.id },
      include: { inventoryItem: true },
    });

    if (!item) {
      return createErrorResponse(
        'NOT_FOUND',
        'Item not found',
        404
      );
    }

    // Update or create inventory item
    let inventoryItem;
    if (item.inventoryItem) {
      inventoryItem = await prisma.inventoryItem.update({
        where: { id: item.inventoryItem.id },
        data: { currentStock: stockValue },
      });
    } else {
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          itemId: item.id,
          currentStock: stockValue,
        },
      });
    }

    return createSuccessResponse(
      {
        itemId: item.id,
        itemName: item.name,
        currentStock: inventoryItem.currentStock,
      },
      'Stock updated successfully'
    );
  } catch (error: any) {
    console.error('Error updating stock:', error);
    return createErrorResponse(
      'UPDATE_ERROR',
      `Failed to update stock: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
