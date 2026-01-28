import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /api/todays-orders - Get orders due today from vendor schedules and scheduled orders
export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const todayDayName = DAY_NAMES[today.getDay()];
    
    // 1. Get vendor schedules that are due today
    const schedules = await prisma.vendorOrderSchedule.findMany({
      where: {
        isActive: true,
        orderDay: todayDayName,
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

    // 2. Get scheduled orders for today
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const scheduledOrders = await prisma.scheduledOrder.findMany({
      where: {
        scheduleDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
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

    // Build combined list with status
    const todaysOrders = schedules.map((schedule) => {
      // Check if there's a matching scheduled order
      const matchingOrder = scheduledOrders.find(
        (o) => o.vendorId === schedule.vendorId
      );

      const deadline = schedule.orderDeadline;
      let status: 'upcoming' | 'due-now' | 'overdue' | 'placed' = 'upcoming';

      if (matchingOrder?.status === 'placed' || matchingOrder?.purchaseOrder) {
        status = 'placed';
      } else if (deadline) {
        const match = deadline.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (match) {
          let hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hour !== 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          const deadlineTime = new Date(today);
          deadlineTime.setHours(hour, minute, 0, 0);

          const now = new Date();
          const minutesUntilDeadline = (deadlineTime.getTime() - now.getTime()) / (1000 * 60);

          if (minutesUntilDeadline < 0) {
            status = 'overdue';
          } else if (minutesUntilDeadline <= 60) {
            status = 'due-now';
          }
        }
      }

      return {
        scheduleId: schedule.id,
        scheduledOrderId: matchingOrder?.id || null,
        vendorId: schedule.vendorId,
        vendorName: schedule.vendor.name,
        orderDay: schedule.orderDay,
        orderDeadline: schedule.orderDeadline,
        deliveryDay: schedule.deliveryDay,
        frequency: schedule.frequency,
        status,
        purchaseOrder: matchingOrder?.purchaseOrder || null,
        notes: schedule.notes,
      };
    });

    // Sort: overdue first, then due-now, then upcoming, then placed
    const statusOrder: Record<string, number> = { overdue: 0, 'due-now': 1, upcoming: 2, placed: 3 };
    todaysOrders.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

    return createSuccessResponse({
      date: todayStart.toISOString().split('T')[0],
      dayName: todayDayName,
      orders: todaysOrders,
      summary: {
        total: todaysOrders.length,
        overdue: todaysOrders.filter((o) => o.status === 'overdue').length,
        dueNow: todaysOrders.filter((o) => o.status === 'due-now').length,
        upcoming: todaysOrders.filter((o) => o.status === 'upcoming').length,
        placed: todaysOrders.filter((o) => o.status === 'placed').length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching today\'s orders:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      `Failed to fetch today's orders: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
