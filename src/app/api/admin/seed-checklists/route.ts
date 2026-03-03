import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function POST(request: NextRequest) {
  let prisma: PrismaClient | null = null;
  
  try {
    console.log('🚀 Seeding checklist data...');
    
    prisma = new PrismaClient();
    await prisma.$connect();
    
    console.log('📊 Connected to database, starting seed...');

    // Clear existing data
    await prisma.checklistCompletion.deleteMany();
    await prisma.checklistItem.deleteMany(); 
    await prisma.checklistTemplate.deleteMany();
    
    console.log('🗑️ Cleared existing checklist data');

    // Create Kitchen template
    const kitchenTemplate = await prisma.checklistTemplate.create({
      data: {
        name: 'Kitchen & Back Tasks',
        description: 'Daily kitchen cleaning and maintenance tasks',
        section: 'kitchen',
      }
    });

    console.log('✅ Created kitchen template');

    // Kitchen items
    const kitchenItems = [
      'Wipe down all prep surfaces',
      'Clean coffee machine', 
      'Empty dishwasher',
      'Sweep and mop kitchen floor',
      'Clean sinks',
      'Wipe down fridges (exterior)',
      'Clean microwave (inside/outside)', 
      'Take out rubbish',
      'Stack dishwasher',
      'Wash pots and pans',
      'Clean bench scales',
      'Organize dry storage area',
      'Check and refill soap dispensers',
      'Wipe down light switches and door handles'
    ];

    for (let i = 0; i < kitchenItems.length; i++) {
      await prisma.checklistItem.create({
        data: {
          title: kitchenItems[i],
          templateId: kitchenTemplate.id,
          sortOrder: i + 1,
        }
      });
    }

    console.log(`✅ Created ${kitchenItems.length} kitchen items`);

    // Create Front template
    const frontTemplate = await prisma.checklistTemplate.create({
      data: {
        name: 'Front of House Tasks',
        description: 'Customer-facing area maintenance and presentation', 
        section: 'front',
      }
    });

    console.log('✅ Created front template');

    // Front items
    const frontItems = [
      'Wipe down all tables and chairs',
      'Vacuum or sweep floors', 
      'Clean windows (inside)',
      'Dust shelves and displays',
      'Organize product displays',
      'Clean entrance door and handles',
      'Empty customer bins',
      'Clean and organize counter area',
      'Wipe down payment terminal',
      'Check and straighten signage',
      'Clean light switches and power points',
      'Organize takeaway supplies',
      'Clean mirrors (if any)',
      'Straighten magazines/reading material',
      'Water plants (if any)',
      'Clean menu boards',
      'Organize brochures/flyers',
      'Check customer seating for damage',
      'Clean phone/communication devices',
      'Spot clean walls and surfaces',
      'Check and replace paper towels',
      'Clean customer-facing fridge doors',
      'Organize and clean weighing scales', 
      'Check lighting and replace bulbs',
      'Clean and organize entrance area'
    ];

    for (let i = 0; i < frontItems.length; i++) {
      await prisma.checklistItem.create({
        data: {
          title: frontItems[i],
          templateId: frontTemplate.id,
          sortOrder: i + 1,
        }
      });
    }

    console.log(`✅ Created ${frontItems.length} front items`);

    // Create Barista template
    const baristaTemplate = await prisma.checklistTemplate.create({
      data: {
        name: 'Barista Tasks',
        description: 'Coffee service and barista station maintenance',
        section: 'barista',
      }
    });

    console.log('✅ Created barista template');

    // Barista items
    const baristaItems = [
      'Clean espresso machine',
      'Clean and calibrate grinder',
      'Organize coffee station', 
      'Clean milk steaming equipment',
      'Check coffee bean supply',
      'Clean cup and saucer storage',
      'Wipe down barista station surfaces'
    ];

    for (let i = 0; i < baristaItems.length; i++) {
      await prisma.checklistItem.create({
        data: {
          title: baristaItems[i],
          templateId: baristaTemplate.id,
          sortOrder: i + 1,
        }
      });
    }

    console.log(`✅ Created ${baristaItems.length} barista items`);

    // Get counts
    const templateCount = await prisma.checklistTemplate.count();
    const itemCount = await prisma.checklistItem.count();

    return Response.json({
      success: true,
      message: 'Checklist data seeded successfully',
      stats: {
        templates: templateCount,
        items: itemCount,
        breakdown: {
          kitchen: kitchenItems.length,
          front: frontItems.length, 
          barista: baristaItems.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Seed error:', error);
    return Response.json({
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
    
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

export const dynamic = 'force-dynamic';