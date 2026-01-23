import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// PATCH /api/calendar/orders/[id] - Update scheduled order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await request.json();
    const {
      vendorId,
      deliveryDate,
      orderDeadline,
      orderedBy,
      notes,
      status,
      editSeriesMode,
      isRecurring,
      recurringPattern,
    } = body;

    // Get the order to check if it's part of a recurring series
    const existingOrder = await prisma.scheduledOrder.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return createErrorResponse('NOT_FOUND', 'Order not found', 404);
    }

    // If editing a recurring order and editSeriesMode is true, update all future occurrences
    if (existingOrder.isRecurring && editSeriesMode) {
      // Update this order and all future orders with the same vendorId and recurringPattern
      await prisma.scheduledOrder.updateMany({
        where: {
          vendorId: existingOrder.vendorId,
          isRecurring: true,
          recurringPattern: existingOrder.recurringPattern,
          scheduleDate: {
            gte: existingOrder.scheduleDate,
          },
        },
        data: {
          vendorId: vendorId || existingOrder.vendorId,
          orderDeadline: orderDeadline !== undefined ? orderDeadline : existingOrder.orderDeadline,
          orderedBy: orderedBy !== undefined ? orderedBy : existingOrder.orderedBy,
          notes: notes !== undefined ? notes : existingOrder.notes,
          status: status || existingOrder.status,
        },
      });

      return createSuccessResponse(
        { updated: true, seriesUpdate: true },
        'Recurring order series updated successfully'
      );
    } else {
      // Update only this single order
      const updateData: any = {};
      if (vendorId) updateData.vendorId = vendorId;
      if (deliveryDate) {
        updateData.deliveryDate = new Date(deliveryDate);
        updateData.scheduleDate = new Date(deliveryDate);
      }
      if (orderDeadline !== undefined) updateData.orderDeadline = orderDeadline;
      if (orderedBy !== undefined) updateData.orderedBy = orderedBy;
      if (notes !== undefined) updateData.notes = notes;
      if (status) updateData.status = status;
      if (body.customDays !== undefined) updateData.customDays = body.customDays ? JSON.stringify(body.customDays) : null;
      if (body.recurringEndDate !== undefined) updateData.recurringEndDate = body.recurringEndDate ? new Date(body.recurringEndDate) : null;

      // If editing single occurrence of recurring order, mark it as non-recurring
      if (existingOrder.isRecurring && !editSeriesMode) {
        updateData.isRecurring = false;
        updateData.recurringPattern = null;
      }

      const order = await prisma.scheduledOrder.update({
        where: { id: orderId },
        data: updateData,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Parse customDays for response
      const transformedOrder = {
        ...order,
        customDays: order.customDays ? JSON.parse(order.customDays) : null,
      };

      return createSuccessResponse(transformedOrder, 'Order updated successfully');
    }
  } catch (error: any) {
    console.error('Error updating order:', error);
    return createErrorResponse(
      'UPDATE_ERROR',
      `Failed to update order: ${error.message}`,
      500
    );
  }
}

// DELETE /api/calendar/orders/[id] - Delete scheduled order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Check if order exists and has a purchase order
    const order = await prisma.scheduledOrder.findUnique({
      where: { id: orderId },
      include: {
        purchaseOrder: true,
      },
    });

    if (!order) {
      return createErrorResponse('NOT_FOUND', 'Order not found', 404);
    }

    // Don't allow deleting if there's an associated purchase order
    if (order.purchaseOrder) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Cannot delete order with associated purchase order',
        400
      );
    }

    await prisma.scheduledOrder.delete({
      where: { id: orderId },
    });

    return createSuccessResponse(
      { deleted: true },
      'Order deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return createErrorResponse(
      'DELETE_ERROR',
      `Failed to delete order: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
