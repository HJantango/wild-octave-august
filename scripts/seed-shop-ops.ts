import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧊 Seeding Shop Ops - Fridge Maintenance Tasks...\n');

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
    console.log(`  ✓ Staff: ${staff.name}`);
  }

  // Create fridge cleaning tasks (7 fridges, once per month each)
  const fridges = [
    { name: 'Dairy Fridge (Double)', asset: 'Dairy Fridge' },
    { name: 'Cheese Fridge', asset: 'Cheese Fridge' },
    { name: 'Tempeh & Tofu Fridge', asset: 'Tempeh Fridge' },
    { name: 'Drinks Fridge', asset: 'Drinks Fridge' },
    { name: 'Fruit & Veg Fridge', asset: 'Fruit & Veg Fridge' },
    { name: 'Cafe Cold Display', asset: 'Cafe Display' },
    { name: 'Back Fridge', asset: 'Back Fridge' }, // Assuming this is #7
  ];

  const freezers = [
    { name: 'Main Freezer', asset: 'Main Freezer' },
    { name: 'Secondary Freezer', asset: 'Secondary Freezer' },
  ];

  console.log('\n🧊 Creating fridge cleaning tasks...');
  
  for (const fridge of fridges) {
    const task = await prisma.shopOpsTask.upsert({
      where: { 
        id: `fridge-${fridge.asset.toLowerCase().replace(/\s+/g, '-')}` 
      },
      update: {
        name: `Clean ${fridge.name}`,
        description: 'Deep clean fridge: wipe shelves, check seals, remove expired items, sanitize surfaces.',
        assignedTo: ['Jasper'],
      },
      create: {
        id: `fridge-${fridge.asset.toLowerCase().replace(/\s+/g, '-')}`,
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
    console.log(`  ✓ Task: ${task.name}`);
  }

  console.log('\n❄️ Creating freezer maintenance tasks...');
  
  for (const freezer of freezers) {
    const task = await prisma.shopOpsTask.upsert({
      where: { 
        id: `freezer-${freezer.asset.toLowerCase().replace(/\s+/g, '-')}` 
      },
      update: {
        name: `Maintain ${freezer.name}`,
        description: 'Check freezer temperature, defrost if needed, organize contents, check expiry dates.',
        assignedTo: ['Jasper'],
      },
      create: {
        id: `freezer-${freezer.asset.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Maintain ${freezer.name}`,
        description: 'Check freezer temperature, defrost if needed, organize contents, check expiry dates.',
        category: 'freezer',
        asset: freezer.asset,
        frequencyType: 'monthly',
        frequencyValue: 2, // Every 2 months
        estimatedMinutes: 45,
        assignedTo: ['Jasper'],
      },
    });
    console.log(`  ✓ Task: ${task.name}`);
  }

  // Generate schedules for the next 3 months
  // Spread 7 fridges across each month (~2 per week)
  console.log('\n📅 Generating schedules for next 3 months...');
  
  const allTasks = await prisma.shopOpsTask.findMany({
    where: { isActive: true },
  });

  const now = new Date();
  
  for (const task of allTasks) {
    const monthsAhead = 3;
    let scheduleCount = 0;
    
    for (let month = 0; month < monthsAhead; month++) {
      // Calculate spread dates based on task index
      const taskIndex = allTasks.indexOf(task);
      const fridgeCount = fridges.length;
      
      if (task.category === 'fridge') {
        // Spread fridges across the month
        // Week 1: fridges 0-1, Week 2: fridges 2-3, Week 3: fridges 4-5, Week 4: fridge 6
        const weekOffset = Math.floor((taskIndex % fridgeCount) / 2);
        const dayOffset = (taskIndex % 2) * 2; // Spread within week
        
        const dueDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
        dueDate.setDate(dueDate.getDate() + (weekOffset * 7) + dayOffset);
        
        // Skip if in the past
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
              assignedTo: task.assignedTo[0] || null,
            },
          });
          scheduleCount++;
        }
      } else if (task.category === 'freezer') {
        // Freezers every 2 months
        if (month % 2 === 0) {
          const dueDate = new Date(now.getFullYear(), now.getMonth() + month, 15); // Mid-month
          
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
                assignedTo: task.assignedTo[0] || null,
              },
            });
            scheduleCount++;
          }
        }
      }
    }
    
    console.log(`  ✓ ${task.name}: ${scheduleCount} schedules created`);
  }

  console.log('\n✅ Shop Ops seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
