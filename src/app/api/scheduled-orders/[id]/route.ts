import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET /api/scheduled-orders/[id] - Get a specific scheduled order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const order = await prisma.scheduledOrder.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalIncGst: true,
          },
        },
      },
    });

    if (!order) {
      return createErrorResponse('NOT_FOUND', 'Scheduled order not found', 404);
    }

    return createSuccessResponse(order);
  } catch (error: any) {
    console.error('Error fetching scheduled order:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      'Failed to fetch scheduled order',
      500
    );
  }
}

// PUT /api/scheduled-orders/[id] - Update a scheduled order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updateData: any = {};
    if (body.scheduleDate) updateData.scheduleDate = new Date(body.scheduleDate);
    if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.purchaseOrderId !== undefined) updateData.purchaseOrderId = body.purchaseOrderId;

    // Update placed tracking
    if (body.status === 'placed' && body.placedBy) {
      updateData.placedAt = new Date();
      updateData.placedBy = body.placedBy;
    }

    const order = await prisma.scheduledOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    return createSuccessResponse(order, 'Scheduled order updated successfully');
  } catch (error: any) {
    console.error('Error updating scheduled order:', error);
    return createErrorResponse(
      'UPDATE_ERROR',
      `Failed to update scheduled order: ${error.message}`,
      500
    );
  }
}

// DELETE /api/scheduled-orders/[id] - Delete a scheduled order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.scheduledOrder.delete({
      where: { id },
    });

    return createSuccessResponse(
      { deleted: true },
      'Scheduled order deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting scheduled order:', error);
    return createErrorResponse(
      'DELETE_ERROR',
      `Failed to delete scheduled order: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
