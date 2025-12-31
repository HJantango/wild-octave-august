import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Validation schema for updating validation status
const validationUpdateSchema = z.object({
  validationStatus: z.enum(['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED']).optional(),
  validationNotes: z.string().nullable().optional(),
  validatedBy: z.string().optional(),
  validatedAt: z.string().optional(),
});

// Common response helpers
function createSuccessResponse(data: any, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    message
  });
}

function createErrorResponse(error: string, message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { type: error, message }
    },
    { status }
  );
}

// Validation helper
function validateRequest(schema: z.ZodSchema, data: any) {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { 
        success: false, 
        error: createErrorResponse('VALIDATION_ERROR', `Validation failed: ${errorMessage}`, 400)
      };
    }
    return { 
      success: false, 
      error: createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400)
    };
  }
}

interface RouteParams {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: invoiceId, itemId } = await params;
    
    // Validate basic parameters
    if (!invoiceId || !itemId) {
      return createErrorResponse('INVALID_PARAMS', 'Invoice ID and Item ID are required', 400);
    }

    // Parse request body
    const body = await request.json();
    const validation = validateRequest(validationUpdateSchema, body);
    
    if (!validation.success) {
      return validation.error;
    }

    const updateData = validation.data;

    // Find the line item
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: itemId,
        invoiceId: invoiceId,
      },
      include: {
        invoice: {
          select: {
            id: true,
            vendor: {
              select: {
                name: true,
              }
            }
          }
        }
      }
    });

    if (!lineItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Invoice line item not found', 404);
    }

    // Prepare update data
    const updateFields: any = {};
    
    if (updateData.validationStatus) {
      updateFields.validationStatus = updateData.validationStatus;
    }
    
    if (updateData.validationNotes !== undefined) {
      updateFields.validationNotes = updateData.validationNotes;
    }
    
    if (updateData.validatedBy) {
      updateFields.validatedBy = updateData.validatedBy;
    }
    
    if (updateData.validatedAt) {
      updateFields.validatedAt = new Date(updateData.validatedAt);
    }

    // If marking as approved or rejected, ensure validation is no longer needed
    if (updateData.validationStatus === 'APPROVED' || updateData.validationStatus === 'REJECTED') {
      updateFields.needsValidation = false;
    }

    // Update the line item
    const updatedLineItem = await prisma.invoiceLineItem.update({
      where: { id: itemId },
      data: updateFields,
    });

    console.log(`🔍 VALIDATION UPDATE: ${lineItem.name}`);
    console.log(`  Status: ${updateFields.validationStatus || 'unchanged'}`);
    console.log(`  Validated by: ${updateFields.validatedBy || 'unknown'}`);
    console.log(`  Notes: ${updateFields.validationNotes || 'none'}`);

    return createSuccessResponse(
      {
        lineItem: updatedLineItem,
        invoice: lineItem.invoice,
      },
      `Validation status updated successfully`
    );

  } catch (error) {
    console.error('Error updating validation status:', error);
    return createErrorResponse('UPDATE_FAILED', 'Failed to update validation status', 500);
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: invoiceId, itemId } = await params;
    
    if (!invoiceId || !itemId) {
      return createErrorResponse('INVALID_PARAMS', 'Invoice ID and Item ID are required', 400);
    }

    // Get validation details for the line item
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: itemId,
        invoiceId: invoiceId,
      },
      select: {
        id: true,
        name: true,
        needsValidation: true,
        validationStatus: true,
        validationFlags: true,
        validationNotes: true,
        validatedBy: true,
        validatedAt: true,
        originalParsedData: true,
        quantity: true,
        unitCostExGst: true,
        category: true,
      }
    });

    if (!lineItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Invoice line item not found', 404);
    }

    return createSuccessResponse(lineItem, 'Validation details retrieved successfully');

  } catch (error) {
    console.error('Error getting validation details:', error);
    return createErrorResponse('FETCH_FAILED', 'Failed to get validation details', 500);
  }
}