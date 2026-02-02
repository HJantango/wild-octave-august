import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET /api/vendor-schedules/[id] - Get a specific vendor schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const schedule = await prisma.vendorOrderSchedule.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!schedule) {
      return createErrorResponse('NOT_FOUND', 'Vendor schedule not found', 404);
    }

    return createSuccessResponse(schedule);
  } catch (error: any) {
    console.error('Error fetching vendor schedule:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      'Failed to fetch vendor schedule',
      500
    );
  }
}

// PUT /api/vendor-schedules/[id] - Update a vendor schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const schedule = await prisma.vendorOrderSchedule.update({
      where: { id },
      data: {
        orderDay: body.orderDay,
        deliveryDay: body.deliveryDay,
        frequency: body.frequency,
        weekOffset: body.weekOffset,
        leadTimeDays: body.leadTimeDays,
        isActive: body.isActive,
        orderDeadline: body.orderDeadline !== undefined ? (body.orderDeadline || null) : undefined,
        assignees: body.assignees !== undefined ? body.assignees : undefined,
        orderType: body.orderType,
        contactMethod: body.contactMethod !== undefined ? (body.contactMethod || null) : undefined,
        trigger: body.trigger !== undefined ? (body.trigger || null) : undefined,
        notes: body.notes,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return createSuccessResponse(schedule, 'Vendor schedule updated successfully');
  } catch (error: any) {
    console.error('Error updating vendor schedule:', error);
    return createErrorResponse(
      'UPDATE_ERROR',
      `Failed to update vendor schedule: ${error.message}`,
      500
    );
  }
}

// DELETE /api/vendor-schedules/[id] - Delete a vendor schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.vendorOrderSchedule.delete({
      where: { id },
    });

    return createSuccessResponse(
      { deleted: true },
      'Vendor schedule deleted successfully'
    );
  } catch (error: any) {
    console.error('Error deleting vendor schedule:', error);
    return createErrorResponse(
      'DELETE_ERROR',
      `Failed to delete vendor schedule: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
