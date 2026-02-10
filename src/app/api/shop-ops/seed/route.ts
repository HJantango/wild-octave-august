import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/shop-ops/seed - Seed initial fridge maintenance tasks
// This is a one-time setup endpoint
export async function POST(request: NextRequest) {
  try {
    // Check for auth header (simple protection)
    const authHeader = request.headers.get('x-seed-key');
    if (authHeader !== 'wild-octave-2024') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    console.log('🧊 Seeding Shop Ops - Fridge Maintenance Tasks...');

    // Create staff members
    const staffMembers = [
      { name: 'Jasper', role: 'staff' },
      { name: 'Heath', role: 'admin' },
      { name: 'Jackie', role: 'admin' },
    ];

    for (const staff of staffMembers) {
      await prisma.shopOpsStaff.upsert({
        where: { name: staff.name },
        update: {},
        create: staff,
      });
    }

    // Create fridge cleaning tasks (7 fridges, once per month each)
    const fridges = [
      { name: 'Dairy Fridge (Double)', asset: 'Dairy Fridge' },
      { name: 'Cheese Fridge', asset: 'Cheese Fridge' },
      { name: 'Tempeh & Tofu Fridge', asset: 'Tempeh Fridge' },
      { name: 'Drinks Fridge', asset: 'Drinks Fridge' },
      { name: 'Fruit & Veg Fridge', asset: 'Fruit & Veg Fridge' },
      { name: 'Cafe Cold Display', asset: 'Cafe Display' },
      { name: 'Back Fridge', asset: 'Back Fridge' },
    ];

    const freezers = [
      { name: 'Main Freezer', asset: 'Main Freezer' },
      { name: 'Secondary Freezer', asset: 'Secondary Freezer' },
    ];

    const allTasks = [];

    // Create fridge tasks
    for (const fridge of fridges) {
      const taskId = `fridge-${fridge.asset.toLowerCase().replace(/\s+/g, '-')}`;
      const task = await prisma.shopOpsTask.upsert({
        where: { id: taskId },
        update: {
          name: `Clean ${fridge.name}`,
          description: 'Deep clean fridge: wipe shelves, check seals, remove expired items, sanitize surfaces.',
          assignedTo: ['Jasper'],
        },
        create: {
          id: taskId,
          name: `Clean ${fridge.name}`,
          description: 'Deep clean fridge: wipe shelves, check seals, remove expired items, sanitize surfaces.',
          category: 'fridge',
          asset: fridge.asset,
          frequencyType: 'monthly',
          frequencyValue: 1,
          estimatedMinutes: 30,
          assignedTo: ['Jasper'],
        },
      });
      allTasks.push(task);
    }

    // Create freezer tasks
    for (const freezer of freezers) {
      const taskId = `freezer-${freezer.asset.toLowerCase().replace(/\s+/g, '-')}`;
      const task = await prisma.shopOpsTask.upsert({
        where: { id: taskId },
        update: {
          name: `Maintain ${freezer.name}`,
          description: 'Check freezer temperature, defrost if needed, organize contents, check expiry dates.',
          assignedTo: ['Jasper'],
        },
        create: {
          id: taskId,
          name: `Maintain ${freezer.name}`,
          description: 'Check freezer temperature, defrost if needed, organize contents, check expiry dates.',
          category: 'freezer',
          asset: freezer.asset,
          frequencyType: 'monthly',
          frequencyValue: 2,
          estimatedMinutes: 45,
          assignedTo: ['Jasper'],
        },
      });
      allTasks.push(task);
    }

    // Generate schedules for the next 3 months
    const now = new Date();
    let schedulesCreated = 0;

    for (let taskIndex = 0; taskIndex < allTasks.length; taskIndex++) {
      const task = allTasks[taskIndex];
      
      for (let month = 0; month < 3; month++) {
        if (task.category === 'fridge') {
          // Spread fridges across the month (~2 per week)
          const weekOffset = Math.floor((taskIndex % fridges.length) / 2);
          const dayOffset = (taskIndex % 2) * 2;
          
          const dueDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
          dueDate.setDate(dueDate.getDate() + (weekOffset * 7) + dayOffset);
          
          if (dueDate >= now) {
            await prisma.shopOpsSchedule.upsert({
              where: {
                taskId_dueDate: {
                  taskId: task.id,
                  dueDate,
                },
              },
              update: {},
              create: {
                taskId: task.id,
                dueDate,
                assignedTo: 'Jasper',
              },
            });
            schedulesCreated++;
          }
        } else if (task.category === 'freezer') {
          // Freezers every 2 months
          if (month % 2 === 0) {
            const dueDate = new Date(now.getFullYear(), now.getMonth() + month, 15);
            
            if (dueDate >= now) {
              await prisma.shopOpsSchedule.upsert({
                where: {
                  taskId_dueDate: {
                    taskId: task.id,
                    dueDate,
                  },
                },
                update: {},
                create: {
                  taskId: task.id,
                  dueDate,
                  assignedTo: 'Jasper',
                },
              });
              schedulesCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Shop Ops seeded successfully!',
      data: {
        staff: staffMembers.length,
        tasks: allTasks.length,
        schedules: schedulesCreated,
      },
    });
  } catch (error) {
    console.error('Error seeding shop-ops:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to seed shop-ops data', details: String(error) } },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET() {
  try {
    const tasks = await prisma.shopOpsTask.count();
    const schedules = await prisma.shopOpsSchedule.count();
    const staff = await prisma.shopOpsStaff.count();

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        schedules,
        staff,
        seeded: tasks > 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to check status', details: String(error) },
    });
  }
}
