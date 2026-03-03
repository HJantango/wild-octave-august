import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing checklist tables migration...');

    // First, check if wrong tables exist and drop them
    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;`;
      await prisma.$executeRaw`DROP TABLE IF EXISTS "ChecklistItem" CASCADE;`;
      await prisma.$executeRaw`DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;`;
      console.log('🗑️ Dropped old tables with wrong names');
    } catch (error) {
      console.log('📝 No old tables to drop');
    }

    // Create tables with correct snake_case names
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "checklist_templates" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "section" TEXT NOT NULL,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "checklist_items" (
          "id" TEXT NOT NULL,
          "template_id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "frequency" TEXT NOT NULL DEFAULT 'daily',
          "specific_days" TEXT[],
          "sort_order" INTEGER NOT NULL DEFAULT 0,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "checklist_completions" (
          "id" TEXT NOT NULL,
          "item_id" TEXT NOT NULL,
          "date" DATE NOT NULL,
          "completed_by" TEXT,
          "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "notes" TEXT,

          CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
      );
    `;

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_templates_section_idx" ON "checklist_templates"("section");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_templates_is_active_idx" ON "checklist_templates"("is_active");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_items_template_id_idx" ON "checklist_items"("template_id");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_items_frequency_idx" ON "checklist_items"("frequency");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_items_sort_order_idx" ON "checklist_items"("sort_order");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_completions_item_id_idx" ON "checklist_completions"("item_id");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "checklist_completions_date_idx" ON "checklist_completions"("date");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "checklist_completions_item_id_date_key" ON "checklist_completions"("item_id", "date");`;

    // Add foreign keys
    await prisma.$executeRaw`
      ALTER TABLE "checklist_items" 
      ADD CONSTRAINT IF NOT EXISTS "checklist_items_template_id_fkey" 
      FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    await prisma.$executeRaw`
      ALTER TABLE "checklist_completions" 
      ADD CONSTRAINT IF NOT EXISTS "checklist_completions_item_id_fkey" 
      FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    console.log('✅ Tables created with correct names');

    // Now seed the data
    await seedChecklistData();
    console.log('✅ Checklist data seeded');

    return createSuccessResponse({
      message: 'Checklist migration fixed successfully',
      steps: [
        '✅ Dropped old incorrectly named tables',
        '✅ Created tables with correct snake_case names',
        '✅ Added indexes and foreign keys',
        '✅ Seeded initial checklist data',
        '📋 Ready to use at /checklists',
      ],
    });

  } catch (error: any) {
    console.error('❌ Migration fix error:', error);
    return createErrorResponse('MIGRATION_FIX_ERROR', error.message, 500);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedChecklistData() {
  // Kitchen/Back Tasks
  const kitchenTemplate = await prisma.checklistTemplate.create({
    data: {
      name: 'Kitchen & Back Tasks',
      description: 'Daily kitchen cleaning and maintenance tasks',
      section: 'kitchen',
    }
  });

  const kitchenItems = [
    { title: 'Wipe down all prep surfaces', description: 'Clean and sanitize all food prep areas' },
    { title: 'Clean coffee machine', description: 'Full clean of espresso machine and grinder' },
    { title: 'Empty dishwasher', description: 'Unload clean dishes and reload' },
    { title: 'Sweep and mop kitchen floor', description: 'Full floor cleaning' },
    { title: 'Clean sinks', description: 'Scrub and sanitize all kitchen sinks' },
    { title: 'Wipe down fridges (exterior)', description: 'Clean all fridge doors and handles' },
    { title: 'Clean microwave (inside/outside)', description: 'Deep clean microwave interior and exterior' },
    { title: 'Take out rubbish', description: 'Empty all bins and replace liners' },
    { title: 'Stack dishwasher', description: 'Load dirty dishes properly' },
    { title: 'Wash pots and pans', description: 'Hand wash large items that don\'t fit in dishwasher' },
    { title: 'Clean bench scales', description: 'Wipe down and calibrate if needed' },
    { title: 'Organize dry storage area', description: 'Tidy and organize storage areas' },
    { title: 'Check and refill soap dispensers', description: 'Ensure all dispensers are full' },
    { title: 'Wipe down light switches and door handles', description: 'Sanitize high-touch surfaces' }
  ];

  for (let i = 0; i < kitchenItems.length; i++) {
    await prisma.checklistItem.create({
      data: {
        ...kitchenItems[i],
        templateId: kitchenTemplate.id,
        sortOrder: i + 1,
      }
    });
  }

  // Front of House Tasks  
  const frontTemplate = await prisma.checklistTemplate.create({
    data: {
      name: 'Front of House Tasks',
      description: 'Customer-facing area maintenance and presentation',
      section: 'front',
    }
  });

  const frontItems = [
    { title: 'Wipe down all tables and chairs', description: 'Clean and sanitize customer seating areas' },
    { title: 'Vacuum or sweep floors', description: 'Clean all customer floor areas' },
    { title: 'Clean windows (inside)', description: 'Wipe down all interior window surfaces' },
    { title: 'Dust shelves and displays', description: 'Clean product display areas' },
    { title: 'Organize product displays', description: 'Straighten and organize retail products' },
    { title: 'Clean entrance door and handles', description: 'Wipe down entry door inside and out' },
    { title: 'Empty customer bins', description: 'Empty and replace liners in customer areas' },
    { title: 'Clean and organize counter area', description: 'Tidy checkout and service counter' },
    { title: 'Wipe down payment terminal', description: 'Clean and sanitize EFTPOS machine' },
    { title: 'Check and straighten signage', description: 'Ensure all signs are clean and properly positioned' },
    { title: 'Clean light switches and power points', description: 'Sanitize electrical fixtures' },
    { title: 'Organize takeaway supplies', description: 'Stock and organize bags, containers, etc.' },
    { title: 'Clean mirrors (if any)', description: 'Wipe down any mirrors or glass surfaces' },
    { title: 'Straighten magazines/reading material', description: 'Organize any customer reading materials' },
    { title: 'Water plants (if any)', description: 'Care for any plants in customer areas' },
    { title: 'Clean menu boards', description: 'Wipe down and check menu displays' },
    { title: 'Organize brochures/flyers', description: 'Stock and straighten promotional materials' },
    { title: 'Check customer seating for damage', description: 'Inspect chairs and tables for issues' },
    { title: 'Clean phone/communication devices', description: 'Sanitize phones and tablets' },
    { title: 'Spot clean walls and surfaces', description: 'Address any marks or stains on walls' },
    { title: 'Check and replace paper towels', description: 'Ensure dispensers are stocked' },
    { title: 'Clean customer-facing fridge doors', description: 'Wipe down all customer-accessible fridges' },
    { title: 'Organize and clean weighing scales', description: 'Clean and check customer scales' },
    { title: 'Check lighting and replace bulbs', description: 'Ensure all lights are working properly' },
    { title: 'Clean and organize entrance area', description: 'Keep entrance welcoming and tidy' }
  ];

  for (let i = 0; i < frontItems.length; i++) {
    await prisma.checklistItem.create({
      data: {
        ...frontItems[i],
        templateId: frontTemplate.id,
        sortOrder: i + 1,
      }
    });
  }

  // Barista Tasks
  const baristaTemplate = await prisma.checklistTemplate.create({
    data: {
      name: 'Barista Tasks',
      description: 'Coffee service and barista station maintenance',
      section: 'barista',
    }
  });

  const baristaItems = [
    { title: 'Clean espresso machine', description: 'Full clean and maintenance of espresso machine' },
    { title: 'Clean and calibrate grinder', description: 'Clean grinder and check grind settings' },
    { title: 'Organize coffee station', description: 'Tidy and stock barista work area' },
    { title: 'Clean milk steaming equipment', description: 'Deep clean steam wands and milk jugs' },
    { title: 'Check coffee bean supply', description: 'Ensure adequate coffee bean stock' },
    { title: 'Clean cup and saucer storage', description: 'Organize and clean coffee service items' },
    { title: 'Wipe down barista station surfaces', description: 'Clean all work surfaces and equipment' }
  ];

  for (let i = 0; i < baristaItems.length; i++) {
    await prisma.checklistItem.create({
      data: {
        ...baristaItems[i],
        templateId: baristaTemplate.id,
        sortOrder: i + 1,
      }
    });
  }
}

export const dynamic = 'force-dynamic';