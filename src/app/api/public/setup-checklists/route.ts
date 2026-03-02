import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Import Prisma dynamically to avoid initialization issues
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    console.log('🚀 Setting up checklist system...');

    // Check if tables already exist
    try {
      const existingTemplates = await prisma.checklistTemplate.count();
      if (existingTemplates > 0) {
        return createSuccessResponse({
          message: 'Checklist system already set up',
          templatesCount: existingTemplates,
          status: 'already_exists',
        });
      }
    } catch (error: any) {
      // Tables don't exist, continue with setup
      console.log('📊 Tables need to be created');
    }

    // Create checklist templates with data
    const checklistData = [
      {
        id: 'kitchen-back-tasks',
        name: "Kitchen / Back Daily Tasks",
        section: "kitchen",
        items: [
          { title: "Clean cooking utensils", frequency: "daily", sortOrder: 0 },
          { title: "Pull out dishwasher", frequency: "daily", sortOrder: 1 },
          { title: "Sweep / Mop floors", frequency: "daily", sortOrder: 2 },
          { title: "Clean all surfaces", frequency: "daily", sortOrder: 3 },
          { title: "Clean smoothie/juice machine", frequency: "daily", sortOrder: 4 },
          { title: "Sink / dishes clear", frequency: "daily", sortOrder: 5 },
          { title: "Boxes from back in kitchen before lockup", frequency: "daily", sortOrder: 6 },
          { title: "Back door locked", frequency: "daily", sortOrder: 7 },
          { title: "Eco refills system 33", frequency: "daily", sortOrder: 8 },
          { title: "Clean behind kitchen fridges", frequency: "daily", sortOrder: 9 },
          { title: "Bins emptied", frequency: "daily", sortOrder: 10 },
          { title: "Clean toilets", frequency: "specific_days", specificDays: ["wednesday", "saturday"], sortOrder: 11 },
          { title: "Back crates cleaned / concrete swept/hosed, drain cleared", frequency: "specific_days", specificDays: ["wednesday"], sortOrder: 12 },
          { title: "Cutlery canisters wash properly", frequency: "specific_days", specificDays: ["monday"], sortOrder: 13 },
        ]
      },
      {
        id: 'front-house-tasks',
        name: "Front of House Tasks",
        section: "front",
        items: [
          { title: "Clean bulk section", frequency: "daily", sortOrder: 0 },
          { title: "Restock drinks fridge", frequency: "daily", sortOrder: 1 },
          { title: "Clean cool room", frequency: "daily", sortOrder: 2 },
          { title: "Clean Office", frequency: "daily", sortOrder: 3 },
          { title: "Clean under coffee machine", frequency: "daily", sortOrder: 4 },
          { title: "Fridge dates", frequency: "daily", sortOrder: 5 },
          { title: "Fridge Temps", frequency: "daily", sortOrder: 6 },
          { title: "Clean dry store", frequency: "daily", sortOrder: 7 },
          { title: "Clean make-up shelves", frequency: "daily", sortOrder: 8 },
          { title: "Clean under make-up shelves", frequency: "daily", sortOrder: 9 },
          { title: "Sweep / Mop floors", frequency: "daily", sortOrder: 10 },
          { title: "Deep clean tables and chairs", frequency: "daily", sortOrder: 11 },
          { title: "Clean liquid bulk area and buckets", frequency: "daily", sortOrder: 12 },
          { title: "Wrap cold display food", frequency: "daily", sortOrder: 13 },
          { title: "Clean/wipe cold display", frequency: "daily", sortOrder: 14 },
          { title: "Clean pie machine", frequency: "daily", sortOrder: 15 },
          { title: "Pull cafe window closed, lock", frequency: "daily", sortOrder: 16 },
          { title: "Sauces, cutlery etc inside", frequency: "daily", sortOrder: 17 },
          { title: "Bring tables inside", frequency: "daily", sortOrder: 18 },
          { title: "Clean top fridges", frequency: "daily", sortOrder: 19 },
          { title: "Put away fruit & veg -> coolroom", frequency: "daily", sortOrder: 20 },
          { title: "Lock all doors", frequency: "daily", sortOrder: 21 },
          { title: "Bins emptied - 2x front, office", frequency: "daily", sortOrder: 22 },
          { title: "Clean fruit & veg fridge", frequency: "specific_days", specificDays: ["tuesday"], sortOrder: 23 },
          { title: "Clean fruit & veg shelves", frequency: "specific_days", specificDays: ["thursday"], sortOrder: 24 },
        ]
      },
      {
        id: 'barista-tasks',
        name: "Barista Tasks",
        section: "barista",
        items: [
          { title: "Pack down machine, clean properly", frequency: "daily", sortOrder: 0 },
          { title: "Clean coffee bench", frequency: "daily", sortOrder: 1 },
          { title: "Empty Ice bucket", frequency: "daily", sortOrder: 2 },
          { title: "Reset bells - 1x coffee machine, 1x cafe till, 1x door till", frequency: "daily", sortOrder: 3 },
          { title: "Restock cutlery", frequency: "daily", sortOrder: 4 },
          { title: "Clean milk containers, jugs etc", frequency: "daily", sortOrder: 5 },
          { title: "Turn off machine", frequency: "daily", sortOrder: 6 },
        ]
      }
    ];

    let templatesCreated = 0;
    let itemsCreated = 0;

    for (const template of checklistData) {
      console.log(`Creating ${template.name} checklist...`);
      
      const createdTemplate = await prisma.checklistTemplate.upsert({
        where: { id: template.id },
        update: {
          name: template.name,
          items: {
            deleteMany: {},
            create: template.items.map((item) => ({
              title: item.title,
              frequency: item.frequency,
              specificDays: item.specificDays || [],
              sortOrder: item.sortOrder,
            })),
          },
        },
        create: {
          id: template.id,
          name: template.name,
          section: template.section,
          items: {
            create: template.items.map((item) => ({
              title: item.title,
              frequency: item.frequency,
              specificDays: item.specificDays || [],
              sortOrder: item.sortOrder,
            })),
          },
        },
      });
      
      templatesCreated++;
      itemsCreated += template.items.length;
    }

    await prisma.$disconnect();

    return createSuccessResponse({
      message: 'Checklist system setup completed successfully',
      templatesCreated,
      itemsCreated,
      steps: [
        '✅ Database tables created/updated',
        `✅ ${templatesCreated} checklist templates created`,
        `✅ ${itemsCreated} checklist items added`,
        '📋 Ready to use at /checklists',
      ],
      nextSteps: [
        'Navigate to /checklists to view weekly tasks',
        'Use /checklists/manage to edit templates',
        'Staff can mark tasks as complete',
        'Print weekly layouts for lamination',
      ],
    });

  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return createErrorResponse('SETUP_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';