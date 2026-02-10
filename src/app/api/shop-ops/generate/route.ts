import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// POST /api/shop-ops/generate - Generate schedules for a specific month
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year, overwrite = false } = body;

    if (month === undefined || year === undefined) {
      return NextResponse.json(
        { success: false, error: { message: 'Month and year are required' } },
        { status: 400 }
      );
    }

    // Get all active tasks
    const tasks = await prisma.shopOpsTask.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const fridgeTasks = tasks.filter(t => t.category === 'fridge');
    const freezerTasks = tasks.filter(t => t.category === 'freezer');

    // Calculate dates for the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Find weeks in the month (weeks that have days in this month)
    const weeks: { start: Date; end: Date; weekNumber: number }[] = [];
    let weekNumber = 1;
    let currentDate = new Date(firstDay);

    while (currentDate <= lastDay) {
      const weekStart = new Date(currentDate);
      // Go to end of week (Saturday) or end of month
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + (6 - currentDate.getDay()));
      if (weekEnd > lastDay) {
        weekEnd.setTime(lastDay.getTime());
      }

      weeks.push({
        start: weekStart,
        end: weekEnd,
        weekNumber,
      });

      // Move to next week (Sunday)
      currentDate = new Date(weekEnd);
      currentDate.setDate(currentDate.getDate() + 1);
      weekNumber++;
    }

    // If overwrite, delete existing pending schedules for this month
    if (overwrite) {
      await prisma.shopOpsSchedule.deleteMany({
        where: {
          dueDate: {
            gte: firstDay,
            lte: lastDay,
          },
          status: 'pending',
        },
      });
    }

    const createdSchedules: { taskId: string; dueDate: Date; assignedTo: string | null }[] = [];

    // Distribute fridge tasks across weeks (roughly 2 per week for 7 fridges)
    // Use a round-robin distribution
    for (let i = 0; i < fridgeTasks.length; i++) {
      const task = fridgeTasks[i];
      const weekIndex = i % weeks.length;
      const week = weeks[weekIndex];
      
      // Pick a day within the week (spread them out within the week)
      const dayOffset = Math.floor((i / weeks.length) * 3) + 1; // Offset by 1-3 days
      const dueDate = new Date(week.start);
      dueDate.setDate(week.start.getDate() + Math.min(dayOffset, (week.end.getDate() - week.start.getDate())));
      
      // Don't schedule on Sundays (day 0) - move to Monday
      if (dueDate.getDay() === 0) {
        dueDate.setDate(dueDate.getDate() + 1);
      }

      // Get default assignee from task
      const assignedTo = task.assignedTo && task.assignedTo.length > 0 ? task.assignedTo[0] : null;

      createdSchedules.push({
        taskId: task.id,
        dueDate,
        assignedTo,
      });
    }

    // Handle freezer tasks (bimonthly - only generate for odd/even months based on task)
    for (let i = 0; i < freezerTasks.length; i++) {
      const task = freezerTasks[i];
      
      // For bimonthly: task 0 does Jan, Mar, May... task 1 does Feb, Apr, Jun...
      // Or both in same month - simpler approach: first freezer in week 2, second in week 4
      if (task.frequencyType === 'bimonthly') {
        // Only schedule every other month
        const shouldScheduleThisMonth = (month + i) % 2 === 0;
        if (!shouldScheduleThisMonth) continue;
      }

      const weekIndex = Math.min(1 + i * 2, weeks.length - 1); // Week 2 for first, week 4 for second
      const week = weeks[weekIndex];
      
      const dueDate = new Date(week.start);
      dueDate.setDate(week.start.getDate() + 2); // Mid-week
      
      if (dueDate.getDay() === 0) {
        dueDate.setDate(dueDate.getDate() + 1);
      }

      const assignedTo = task.assignedTo && task.assignedTo.length > 0 ? task.assignedTo[0] : null;

      createdSchedules.push({
        taskId: task.id,
        dueDate,
        assignedTo,
      });
    }

    // Create the schedules (upsert to avoid duplicates)
    let created = 0;
    let skipped = 0;

    for (const schedule of createdSchedules) {
      try {
        await prisma.shopOpsSchedule.upsert({
          where: {
            taskId_dueDate: {
              taskId: schedule.taskId,
              dueDate: schedule.dueDate,
            },
          },
          update: {
            assignedTo: schedule.assignedTo,
          },
          create: {
            taskId: schedule.taskId,
            dueDate: schedule.dueDate,
            assignedTo: schedule.assignedTo,
            status: 'pending',
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        month: month + 1,
        year,
        weeksFound: weeks.length,
        schedulesCreated: created,
        schedulesSkipped: skipped,
        fridgeTasks: fridgeTasks.length,
        freezerTasks: freezerTasks.length,
      },
      message: `Generated ${created} schedules for ${new Date(year, month).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`,
    });
  } catch (error) {
    console.error('Error generating schedules:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to generate schedules' } },
      { status: 500 }
    );
  }
}
