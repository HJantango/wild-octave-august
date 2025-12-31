import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';
import { calculatePricing, getDefaultMarkup } from '@/lib/pricing';
import { z } from 'zod';

const updateLineItemSchema = z.object({
  category: z.string().optional(),
  notes: z.string().optional(),
  quantity: z.number().positive().optional(),
  unitCostExGst: z.number().positive().optional(),
});

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: invoiceId, itemId } = await params;
    
    // Validate IDs
    const invoiceIdValidation = validateRequest(idSchema, invoiceId);
    if (!invoiceIdValidation.success) {
      return invoiceIdValidation.error;
    }

    const itemIdValidation = validateRequest(idSchema, itemId);
    if (!itemIdValidation.success) {
      return itemIdValidation.error;
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequest(updateLineItemSchema, body);
    if (!validation.success) {
      return validation.error;
    }

    const { category, notes, quantity, unitCostExGst } = validation.data;

    // Check if invoice and line item exist
    const existingItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: itemId,
        invoiceId: invoiceId,
      },
    });

    if (!existingItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Line item not found', 404);
    }

    // Prepare update data
    const updateData: any = {};
    
    // Track what changed for notes
    const changes: string[] = [];
    
    if (category !== undefined) {
      updateData.category = category;
      changes.push(`category: ${category}`);
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Handle quantity or unit cost updates - recalculate pricing
    const newQuantity = quantity !== undefined ? quantity : Number(existingItem.quantity);
    const newUnitCost = unitCostExGst !== undefined ? unitCostExGst : Number(existingItem.unitCostExGst);
    const categoryForPricing = category !== undefined ? category : existingItem.category;
    
    if (quantity !== undefined || unitCostExGst !== undefined) {
      // Get markup for pricing calculation
      const markup = await getDefaultMarkup(categoryForPricing);
      
      // Calculate new pricing
      const pricing = calculatePricing(
        newUnitCost,
        markup,
        1, // packSize
        0.10 // GST rate
      );
      
      // Update pricing fields
      updateData.quantity = newQuantity;
      updateData.unitCostExGst = newUnitCost;
      updateData.effectiveUnitCostExGst = newUnitCost;
      updateData.markup = pricing.markup;
      updateData.sellExGst = pricing.sellExGst;
      updateData.sellIncGst = pricing.sellIncGst;
      
      // Track changes
      if (quantity !== undefined) {
        changes.push(`quantity: ${quantity}`);
      }
      if (unitCostExGst !== undefined) {
        changes.push(`unit cost: $${unitCostExGst}`);
      }
      changes.push(`sell price updated: $${pricing.sellExGst} ex GST, $${pricing.sellIncGst} inc GST`);
    }
    
    // Add change notes
    if (changes.length > 0 && notes === undefined) {
      const existingNotes = existingItem.notes || '';
      const changeNote = `\n[${new Date().toLocaleString()}] Updated: ${changes.join(', ')}`;
      updateData.notes = `${existingNotes}${changeNote}`.trim();
    }

    const updatedItem = await prisma.invoiceLineItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // If quantity or unit cost was updated, recalculate invoice totals
    if (quantity !== undefined || unitCostExGst !== undefined) {
      const allLineItems = await prisma.invoiceLineItem.findMany({
        where: { invoiceId: invoiceId },
      });

      // Calculate totals based on unit cost × quantity for each item
      let subtotalExGst = 0;
      let totalGstAmount = 0;
      
      for (const item of allLineItems) {
        const itemUnitCost = item.id === itemId ? newUnitCost : Number(item.unitCostExGst);
        const itemQuantity = item.id === itemId ? newQuantity : Number(item.quantity);
        const itemLineTotal = itemUnitCost * itemQuantity;
        
        subtotalExGst += itemLineTotal;
        
        // Add GST if this item has GST
        if (item.hasGst) {
          totalGstAmount += itemLineTotal * 0.10;
        }
      }
      
      const totalIncGst = subtotalExGst + totalGstAmount;

      console.log(`📊 INVOICE TOTALS RECALCULATED:`);
      console.log(`  Subtotal Ex GST: $${subtotalExGst.toFixed(2)}`);
      console.log(`  GST Amount: $${totalGstAmount.toFixed(2)}`);
      console.log(`  Total Inc GST: $${totalIncGst.toFixed(2)}`);

      // Update invoice totals
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotalExGst,
          gstAmount: totalGstAmount,
          totalIncGst,
        },
      });
    }

    return createSuccessResponse(updatedItem, 'Line item updated successfully');
  } catch (error) {
    console.error('Line item update error:', error);
    return createErrorResponse('ITEM_UPDATE_ERROR', 'Failed to update line item', 500);
  }
}

async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: invoiceId, itemId } = await params;
    
    // Validate IDs
    const invoiceIdValidation = validateRequest(idSchema, invoiceId);
    if (!invoiceIdValidation.success) {
      return invoiceIdValidation.error;
    }

    const itemIdValidation = validateRequest(idSchema, itemId);
    if (!itemIdValidation.success) {
      return itemIdValidation.error;
    }

    // Check if invoice and line item exist
    const existingItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: itemId,
        invoiceId: invoiceId,
      },
    });

    if (!existingItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Line item not found', 404);
    }

    // Delete the line item
    await prisma.invoiceLineItem.delete({
      where: { id: itemId },
    });

    // Recalculate invoice totals after deletion
    const remainingLineItems = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: invoiceId },
    });

    // Calculate new totals
    let subtotalExGst = 0;
    let totalGstAmount = 0;
    
    for (const item of remainingLineItems) {
      const itemUnitCost = Number(item.unitCostExGst);
      const itemQuantity = Number(item.quantity);
      const itemLineTotal = itemUnitCost * itemQuantity;
      
      subtotalExGst += itemLineTotal;
      
      // Add GST if this item has GST
      if (item.hasGst) {
        totalGstAmount += itemLineTotal * 0.10;
      }
    }
    
    const totalIncGst = subtotalExGst + totalGstAmount;

    console.log(`🗑️  ITEM DELETED - INVOICE TOTALS RECALCULATED:`);
    console.log(`  Subtotal Ex GST: $${subtotalExGst.toFixed(2)}`);
    console.log(`  GST Amount: $${totalGstAmount.toFixed(2)}`);
    console.log(`  Total Inc GST: $${totalIncGst.toFixed(2)}`);

    // Update invoice totals
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotalExGst,
        gstAmount: totalGstAmount,
        totalIncGst,
      },
    });

    return createSuccessResponse({ deletedItemId: itemId }, 'Line item deleted successfully');
  } catch (error) {
    console.error('Line item deletion error:', error);
    return createErrorResponse('ITEM_DELETE_ERROR', 'Failed to delete line item', 500);
  }
}

export { PATCH, DELETE };
export const dynamic = 'force-dynamic';