import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// PATCH /api/shop-ops/schedule/[id] - Update schedule (complete, assign, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, completedBy, assignedTo, notes, dueDate } = body;

    const updateData: Record<string, unknown> = {};

    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }

    if (status) {
      updateData.status = status;
      
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = completedBy || 'Unknown';

        // Also create a completion record for audit trail
        const schedule = await prisma.shopOpsSchedule.findUnique({
          where: { id },
        });

        if (schedule) {
          await prisma.shopOpsCompletion.create({
            data: {
              taskId: schedule.taskId,
              scheduleId: id,
              completedBy: completedBy || 'Unknown',
              notes,
            },
          });
        }
      }
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updated = await prisma.shopOpsSchedule.update({
      where: { id },
      data: updateData,
      include: {
        task: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: status === 'completed' ? 'Task marked as complete!' : 'Schedule updated',
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update schedule' } },
      { status: 500 }
    );
  }
}

// GET /api/shop-ops/schedule/[id] - Get single schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const schedule = await prisma.shopOpsSchedule.findUnique({
      where: { id },
      include: {
        task: true,
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: { message: 'Schedule not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch schedule' } },
      { status: 500 }
    );
  }
}
