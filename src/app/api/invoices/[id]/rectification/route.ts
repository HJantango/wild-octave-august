import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const rectificationUpdateSchema = z.object({
  needsRectification: z.boolean().optional(),
  rectificationNotes: z.string().optional(),
  markContacted: z.boolean().optional(),
  markResolved: z.boolean().optional(),
  approveInvoice: z.boolean().optional(),
  resolutionType: z.string().optional(),
  resolutionValue: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = validateRequest(idSchema, id);

    if (!idValidation.success) {
      return idValidation.error;
    }

    const body = await request.json();
    const validation = validateRequest(rectificationUpdateSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { 
      needsRectification, 
      rectificationNotes, 
      markContacted, 
      markResolved, 
      approveInvoice,
      resolutionType,
      resolutionValue
    } = validation.data;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    // Prepare update data
    const updateData: any = {};

    if (needsRectification !== undefined) {
      updateData.needsRectification = needsRectification;
      // If setting to false, clear rectification fields
      if (!needsRectification) {
        updateData.rectificationContactedAt = null;
        updateData.rectificationResolvedAt = null;
        updateData.rectificationNotes = null;
      }
    }

    if (rectificationNotes !== undefined) {
      updateData.rectificationNotes = rectificationNotes;
    }

    if (markContacted !== undefined && markContacted) {
      updateData.rectificationContactedAt = new Date();
    }

    if (markResolved !== undefined && markResolved) {
      updateData.rectificationResolvedAt = new Date();
      // Also mark as contacted if not already
      if (!existingInvoice.rectificationContactedAt) {
        updateData.rectificationContactedAt = new Date();
      }
      // Add resolution details if provided
      if (resolutionType) {
        updateData.resolutionType = resolutionType;
      }
      if (resolutionValue) {
        updateData.resolutionValue = resolutionValue;
      }
    }

    // If approving invoice and resolving rectification
    if (approveInvoice && markResolved) {
      updateData.status = 'APPROVED';
      updateData.needsRectification = false;
      updateData.rectificationResolvedAt = new Date();
      if (!existingInvoice.rectificationContactedAt) {
        updateData.rectificationContactedAt = new Date();
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: { id: true, name: true, contactInfo: true },
        },
        lineItems: {
          select: { 
            id: true, 
            name: true, 
            quantity: true, 
            unitCostExGst: true,
          },
        },
      },
    });

    let message = 'Rectification status updated successfully';
    if (approveInvoice) {
      message = 'Invoice approved and rectification marked as resolved';
    } else if (markResolved) {
      message = 'Rectification marked as resolved';
    } else if (markContacted) {
      message = 'Vendor marked as contacted';
    }

    return createSuccessResponse(updatedInvoice, message);
  } catch (error) {
    console.error('Rectification update error:', error);
    return createErrorResponse('RECTIFICATION_UPDATE_ERROR', 'Failed to update rectification status', 500);
  }
}