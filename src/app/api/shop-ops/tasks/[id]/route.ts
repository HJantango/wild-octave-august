import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// PATCH /api/shop-ops/tasks/[id] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, category, asset, frequencyType, frequencyValue, estimatedMinutes, assignedTo, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (asset !== undefined) updateData.asset = asset;
    if (frequencyType !== undefined) updateData.frequencyType = frequencyType;
    if (frequencyValue !== undefined) updateData.frequencyValue = frequencyValue;
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.shopOpsTask.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Task updated',
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update task' } },
      { status: 500 }
    );
  }
}

// DELETE /api/shop-ops/tasks/[id] - Soft delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete - just mark as inactive
    await prisma.shopOpsTask.update({
      where: { id },
      data: { isActive: false },
    });

    // Also cancel pending schedules for this task
    await prisma.shopOpsSchedule.updateMany({
      where: {
        taskId: id,
        status: 'pending',
      },
      data: {
        status: 'skipped',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete task' } },
      { status: 500 }
    );
  }
}

// GET /api/shop-ops/tasks/[id] - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.shopOpsTask.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: { message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch task' } },
      { status: 500 }
    );
  }
}
