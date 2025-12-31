import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { updateInvoiceSchema, idSchema } from '@/lib/validations';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, name: true, contactInfo: true },
        },
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    // Remove raw PDF data from response (too large for JSON)
    const { rawPdf, ...invoiceWithoutPdf } = invoice;

    // DEBUG: Log first line item to see what's actually in database
    if (invoiceWithoutPdf.lineItems && invoiceWithoutPdf.lineItems.length > 0) {
      console.log('DEBUG: Database contains line item name:', invoiceWithoutPdf.lineItems[0].name);
    }

    return createSuccessResponse(invoiceWithoutPdf);
  } catch (error) {
    console.error('Invoice fetch error:', error);
    return createErrorResponse('INVOICE_FETCH_ERROR', 'Failed to fetch invoice', 500);
  }
}

async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = validateRequest(idSchema, id);

    if (!idValidation.success) {
      return idValidation.error;
    }

    const body = await request.json();
    const validation = validateRequest(updateInvoiceSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { status, lineItems, allItemsReceived, allItemsCheckedIn, missingItems, receivingNotes, needsRectification, rectificationNotes, rectificationContactedAt, rectificationResolvedAt } = validation.data;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existingInvoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Update invoice fields if provided
      const invoiceUpdate: any = {};
      if (status !== undefined) invoiceUpdate.status = status;
      if (allItemsReceived !== undefined) invoiceUpdate.allItemsReceived = allItemsReceived;
      if (allItemsCheckedIn !== undefined) invoiceUpdate.allItemsCheckedIn = allItemsCheckedIn;
      if (missingItems !== undefined) invoiceUpdate.missingItems = missingItems;
      if (receivingNotes !== undefined) invoiceUpdate.receivingNotes = receivingNotes;
      if (needsRectification !== undefined) invoiceUpdate.needsRectification = needsRectification;
      if (rectificationNotes !== undefined) invoiceUpdate.rectificationNotes = rectificationNotes;
      if (rectificationContactedAt !== undefined) invoiceUpdate.rectificationContactedAt = rectificationContactedAt;
      if (rectificationResolvedAt !== undefined) invoiceUpdate.rectificationResolvedAt = rectificationResolvedAt;

      console.log(`Updating invoice ${id} with status: ${status}`);
      console.log('Invoice update data:', invoiceUpdate);

      let invoice = existingInvoice;
      if (Object.keys(invoiceUpdate).length > 0) {
        invoice = await tx.invoice.update({
          where: { id },
          data: invoiceUpdate,
        });
        console.log(`Invoice ${id} updated successfully to status: ${invoice.status}`);
      }

      // Update line items if provided
      if (lineItems && lineItems.length > 0) {
        // Delete existing line items
        await tx.invoiceLineItem.deleteMany({
          where: { invoiceId: id },
        });

        // Create new line items
        for (const item of lineItems) {
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: id,
              name: item.name,
              quantity: item.quantity,
              unitCostExGst: item.unitCostExGst,
              detectedPackSize: item.detectedPackSize,
              effectiveUnitCostExGst: item.effectiveUnitCostExGst,
              category: item.category,
              markup: item.markup,
              sellExGst: item.sellExGst,
              sellIncGst: item.sellIncGst,
              notes: item.notes,
            },
          });
        }

        // Recalculate totals
        const subtotalExGst = lineItems.reduce(
          (sum, item) => sum + (item.effectiveUnitCostExGst * item.quantity),
          0
        );
        const gstAmount = subtotalExGst * 0.10;
        const totalIncGst = subtotalExGst + gstAmount;

        invoice = await tx.invoice.update({
          where: { id },
          data: {
            subtotalExGst,
            gstAmount,
            totalIncGst,
          },
        });
      }

      return invoice;
    });

    // Fetch updated invoice with relations
    const result = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: 'asc' } },
      },
    });

    return createSuccessResponse(result, 'Invoice updated successfully');
  } catch (error) {
    console.error('Invoice update error:', error);
    return createErrorResponse('INVOICE_UPDATE_ERROR', 'Failed to update invoice', 500);
  }
}

async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    if (invoice.status === 'POSTED') {
      return createErrorResponse(
        'INVOICE_POSTED',
        'Cannot delete a posted invoice',
        409
      );
    }

    // Delete the invoice from database (cascading deletes will handle line items)
    await prisma.invoice.delete({
      where: { id },
    });
    
    console.log(`Successfully deleted invoice ${id}`);

    return createSuccessResponse(null, 'Invoice deleted successfully');
  } catch (error) {
    console.error('Invoice deletion error:', error);
    return createErrorResponse('INVOICE_DELETE_ERROR', 'Failed to delete invoice', 500);
  }
}

export { GET, PATCH, DELETE };
export const dynamic = 'force-dynamic';