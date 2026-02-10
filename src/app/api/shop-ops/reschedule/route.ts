import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// POST /api/shop-ops/reschedule - Regenerate schedules with proper weekly distribution
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-seed-key');
    if (authHeader !== 'wild-octave-2024') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    console.log('📅 Regenerating shop-ops schedules...');

    // Get all active fridge tasks
    const fridgeTasks = await prisma.shopOpsTask.findMany({
      where: { category: 'fridge', isActive: true },
      orderBy: { name: 'asc' },
    });

    // Get all active freezer tasks
    const freezerTasks = await prisma.shopOpsTask.findMany({
      where: { category: 'freezer', isActive: true },
      orderBy: { name: 'asc' },
    });

    // Delete existing schedules that aren't completed
    await prisma.shopOpsSchedule.deleteMany({
      where: { status: { not: 'completed' } },
    });

    const now = new Date();
    const schedulesCreated: { task: string; date: string }[] = [];

    // Generate 3 months of fridge schedules
    // 7 fridges spread across each month: ~2 per week
    for (let month = 0; month < 3; month++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + month, 1);
      
      // Distribute 7 fridges across the month
      // Week 1: fridge 0, 1 (days 3, 5)
      // Week 2: fridge 2, 3 (days 10, 12)
      // Week 3: fridge 4, 5 (days 17, 19)
      // Week 4: fridge 6 (day 24)
      const weeklySchedule = [
        { week: 1, day: 3, fridgeIndex: 0 },
        { week: 1, day: 5, fridgeIndex: 1 },
        { week: 2, day: 10, fridgeIndex: 2 },
        { week: 2, day: 12, fridgeIndex: 3 },
        { week: 3, day: 17, fridgeIndex: 4 },
        { week: 3, day: 19, fridgeIndex: 5 },
        { week: 4, day: 24, fridgeIndex: 6 },
      ];

      for (const slot of weeklySchedule) {
        if (slot.fridgeIndex < fridgeTasks.length) {
          const task = fridgeTasks[slot.fridgeIndex];
          const dueDate = new Date(monthStart);
          dueDate.setDate(slot.day);
          
          // Skip if date is in the past
          if (dueDate >= now) {
            await prisma.shopOpsSchedule.create({
              data: {
                taskId: task.id,
                dueDate,
                assignedTo: 'Jasper',
                status: 'pending',
              },
            });
            schedulesCreated.push({
              task: task.name,
              date: dueDate.toISOString().split('T')[0],
            });
          }
        }
      }
    }

    // Generate freezer schedules (every 2 months, mid-month)
    for (let i = 0; i < freezerTasks.length; i++) {
      const task = freezerTasks[i];
      
      // Schedule at months 0, 2, 4 (every 2 months)
      for (let month = 0; month < 6; month += 2) {
        const dueDate = new Date(now.getFullYear(), now.getMonth() + month, 15 + i * 2);
        
        if (dueDate >= now) {
          await prisma.shopOpsSchedule.create({
            data: {
              taskId: task.id,
              dueDate,
              assignedTo: 'Jasper',
              status: 'pending',
            },
          });
          schedulesCreated.push({
            task: task.name,
            date: dueDate.toISOString().split('T')[0],
          });
        }
      }
    }

    // Sort by date for display
    schedulesCreated.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      message: 'Schedules regenerated successfully!',
      data: {
        totalSchedules: schedulesCreated.length,
        fridgeTasks: fridgeTasks.length,
        freezerTasks: freezerTasks.length,
        schedules: schedulesCreated,
      },
    });
  } catch (error) {
    console.error('Reschedule error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Reschedule failed', details: String(error) } },
      { status: 500 }
    );
  }
}
