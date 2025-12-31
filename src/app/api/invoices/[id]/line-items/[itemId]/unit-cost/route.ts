import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { calculatePricing, getDefaultMarkup } from '@/lib/pricing';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

const unitCostSchema = z.object({
  unitCostExGst: z.number().positive('Unit cost must be positive'),
  quantity: z.number().positive('Quantity must be positive').optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const body = await request.json();
    
    const validation = validateRequest(unitCostSchema, body);
    if (!validation.success) {
      return validation.error;
    }

    const { unitCostExGst, quantity } = validation.data;

    // Get the current line item
    const lineItem = await prisma.invoiceLineItem.findUnique({
      where: { id: itemId, invoiceId: id },
    });

    if (!lineItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Line item not found', 404);
    }

    // Calculate new pricing based on updated unit cost
    const markup = await getDefaultMarkup(lineItem.category);
    const pricing = calculatePricing(
      unitCostExGst,
      markup,
      lineItem.detectedPackSize || 1,
      lineItem.gstRate / 100 // Convert percentage to decimal
    );

    const updateData: any = {
      unitCostExGst,
      effectiveUnitCostExGst: unitCostExGst,
      sellExGst: pricing.sellExGst,
      sellIncGst: pricing.sellIncGst,
      notes: `${lineItem.notes || ''}\nUnit cost manually updated: $${unitCostExGst}`.trim(),
    };

    // Update quantity if provided
    if (quantity) {
      updateData.quantity = quantity;
    }

    const updatedLineItem = await prisma.invoiceLineItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Recalculate invoice totals
    const allLineItems = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: id },
    });

    const subtotalExGst = allLineItems.reduce((sum, item) => 
      sum + (item.unitCostExGst * item.quantity), 0
    );
    const gstAmount = subtotalExGst * 0.10;
    const totalIncGst = subtotalExGst + gstAmount;

    // Update invoice totals
    await prisma.invoice.update({
      where: { id },
      data: {
        subtotalExGst,
        gstAmount,
        totalIncGst,
      },
    });

    return createSuccessResponse(
      { lineItem: updatedLineItem },
      'Unit cost updated successfully'
    );
  } catch (error) {
    console.error('Update unit cost error:', error);
    return createErrorResponse('UPDATE_ERROR', 'Failed to update unit cost', 500);
  }
}

export const dynamic = 'force-dynamic';