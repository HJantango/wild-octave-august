import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET /api/vendor-schedules - List all vendor schedules
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const schedules = await prisma.vendorOrderSchedule.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { vendor: { name: 'asc' } },
        { orderDay: 'asc' },
      ],
    });

    return createSuccessResponse({
      schedules,
      total: schedules.length,
    });
  } catch (error: any) {
    console.error('Error fetching vendor schedules:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      'Failed to fetch vendor schedules',
      500
    );
  }
}

// POST /api/vendor-schedules - Create a new vendor schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendorId,
      orderDay,
      deliveryDay,
      frequency,
      weekOffset,
      leadTimeDays,
      isActive,
      orderDeadline,
      assignees,
      orderType,
      contactMethod,
      trigger,
      notes,
    } = body;

    if (!vendorId || !orderDay || !frequency) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'vendorId, orderDay, and frequency are required',
        400
      );
    }

    // Check if schedule already exists for this vendor and day
    const existing = await prisma.vendorOrderSchedule.findFirst({
      where: {
        vendorId,
        orderDay,
      },
    });

    if (existing) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'A schedule already exists for this vendor and order day',
        400
      );
    }

    const schedule = await prisma.vendorOrderSchedule.create({
      data: {
        vendorId,
        orderDay,
        deliveryDay: deliveryDay || null,
        frequency: frequency || 'weekly',
        weekOffset: weekOffset !== undefined ? weekOffset : 0,
        leadTimeDays: leadTimeDays !== undefined ? leadTimeDays : 1,
        isActive: isActive !== undefined ? isActive : true,
        orderDeadline: orderDeadline || null,
        assignees: assignees || [],
        orderType: orderType || 'regular',
        contactMethod: contactMethod || null,
        trigger: trigger || null,
        notes,
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

    return createSuccessResponse(schedule, 'Vendor schedule created successfully', 201);
  } catch (error: any) {
    console.error('Error creating vendor schedule:', error);
    return createErrorResponse(
      'CREATE_ERROR',
      `Failed to create vendor schedule: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
