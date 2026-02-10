import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// GET /api/shop-ops - Get tasks and schedules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'calendar';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    if (view === 'tasks') {
      // Return all task templates
      const tasks = await prisma.shopOpsTask.findMany({
        where: {
          isActive: true,
          ...(category && { category }),
        },
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
      });

      return NextResponse.json({
        success: true,
        data: tasks,
      });
    }

    // Default: calendar view - return schedules
    const whereClause: Record<string, unknown> = {};
    
    if (startDate && endDate) {
      whereClause.dueDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else {
      // Default to current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      whereClause.dueDate = {
        gte: firstDay,
        lte: lastDay,
      };
    }

    if (category) {
      whereClause.task = { category };
    }

    const schedules = await prisma.shopOpsSchedule.findMany({
      where: whereClause,
      include: {
        task: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error('Error fetching shop-ops data:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch shop-ops data' } },
      { status: 500 }
    );
  }
}

// POST /api/shop-ops - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category = 'fridge',
      asset,
      frequencyType = 'monthly',
      frequencyValue = 1,
      estimatedMinutes,
      assignedTo = [],
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { message: 'Task name is required' } },
        { status: 400 }
      );
    }

    const task = await prisma.shopOpsTask.create({
      data: {
        name,
        description,
        category,
        asset,
        frequencyType,
        frequencyValue,
        estimatedMinutes,
        assignedTo,
      },
    });

    // Generate initial schedules for the next 3 months
    await generateSchedules(task.id, frequencyType, frequencyValue, 3);

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task created successfully',
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create task' } },
      { status: 500 }
    );
  }
}

// Helper function to generate schedules
async function generateSchedules(
  taskId: string,
  frequencyType: string,
  frequencyValue: number,
  monthsAhead: number
) {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate());
  const schedules: { taskId: string; dueDate: Date }[] = [];

  let currentDate = new Date(now);
  
  while (currentDate <= endDate) {
    schedules.push({
      taskId,
      dueDate: new Date(currentDate),
    });

    // Advance based on frequency
    switch (frequencyType) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7 * frequencyValue);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
      default:
        currentDate.setMonth(currentDate.getMonth() + frequencyValue);
        break;
    }
  }

  // Upsert schedules (avoid duplicates)
  for (const schedule of schedules) {
    await prisma.shopOpsSchedule.upsert({
      where: {
        taskId_dueDate: {
          taskId: schedule.taskId,
          dueDate: schedule.dueDate,
        },
      },
      update: {},
      create: schedule,
    });
  }
}
