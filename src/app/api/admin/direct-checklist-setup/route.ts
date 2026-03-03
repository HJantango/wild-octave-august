import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Setting up checklist system with direct SQL...');

    // Import Pool dynamically to avoid initialization issues
    const { Pool } = await import('pg');
    
    // Get DATABASE_URL from process.env (should be available in Next.js API routes)
    const databaseUrl = process.env.DATABASE_URL;
    console.log('Database URL available:', !!databaseUrl);
    
    if (!databaseUrl) {
      console.error('DATABASE_URL not found in process.env');
      return createErrorResponse('ENV_ERROR', 'DATABASE_URL environment variable not found', 500);
    }

    // Create direct PostgreSQL connection
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('📊 Connecting to database...');
    
    const client = await pool.connect();
    
    try {
      console.log('🗑️ Dropping old tables...');
      await client.query('DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistItem" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;');

      console.log('📊 Creating tables...');
      
      // Create checklist_templates table
      await client.query(`
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
      `);

      // Create checklist_items table  
      await client.query(`
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
      `);

      // Create checklist_completions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "checklist_completions" (
            "id" TEXT NOT NULL,
            "item_id" TEXT NOT NULL,
            "date" DATE NOT NULL,
            "completed_by" TEXT,
            "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "notes" TEXT,
            CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
        );
      `);

      console.log('📇 Creating indexes...');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_templates_section_idx" ON "checklist_templates"("section");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_templates_is_active_idx" ON "checklist_templates"("is_active");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_template_id_idx" ON "checklist_items"("template_id");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_frequency_idx" ON "checklist_items"("frequency");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_sort_order_idx" ON "checklist_items"("sort_order");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_completions_item_id_idx" ON "checklist_completions"("item_id");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_completions_date_idx" ON "checklist_completions"("date");');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "checklist_completions_item_id_date_key" ON "checklist_completions"("item_id", "date");');

      console.log('🔗 Adding foreign keys...');
      await client.query(`
        ALTER TABLE "checklist_items" 
        DROP CONSTRAINT IF EXISTS "checklist_items_template_id_fkey";
      `);
      await client.query(`
        ALTER TABLE "checklist_items" 
        ADD CONSTRAINT "checklist_items_template_id_fkey" 
        FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);

      await client.query(`
        ALTER TABLE "checklist_completions" 
        DROP CONSTRAINT IF EXISTS "checklist_completions_item_id_fkey";
      `);
      await client.query(`
        ALTER TABLE "checklist_completions" 
        ADD CONSTRAINT "checklist_completions_item_id_fkey" 
        FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);

      console.log('🌱 Seeding data...');
      
      // Kitchen template
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, ['kitchen_template_001', 'Kitchen & Back Tasks', 'Daily kitchen cleaning and maintenance tasks', 'kitchen']);

      // Kitchen items
      const kitchenItems = [
        'Wipe down all prep surfaces', 'Clean coffee machine', 'Empty dishwasher', 'Sweep and mop kitchen floor',
        'Clean sinks', 'Wipe down fridges (exterior)', 'Clean microwave (inside/outside)', 'Take out rubbish',
        'Stack dishwasher', 'Wash pots and pans', 'Clean bench scales', 'Organize dry storage area',
        'Check and refill soap dispensers', 'Wipe down light switches and door handles'
      ];

      for (let i = 0; i < kitchenItems.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [`kitchen_${String(i + 1).padStart(3, '0')}`, 'kitchen_template_001', kitchenItems[i], i + 1]);
      }

      // Front template
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, ['front_template_001', 'Front of House Tasks', 'Customer-facing area maintenance and presentation', 'front']);

      // Front items
      const frontItems = [
        'Wipe down all tables and chairs', 'Vacuum or sweep floors', 'Clean windows (inside)', 'Dust shelves and displays',
        'Organize product displays', 'Clean entrance door and handles', 'Empty customer bins', 'Clean and organize counter area',
        'Wipe down payment terminal', 'Check and straighten signage', 'Clean light switches and power points', 'Organize takeaway supplies',
        'Clean mirrors (if any)', 'Straighten magazines/reading material', 'Water plants (if any)', 'Clean menu boards',
        'Organize brochures/flyers', 'Check customer seating for damage', 'Clean phone/communication devices', 'Spot clean walls and surfaces',
        'Check and replace paper towels', 'Clean customer-facing fridge doors', 'Organize and clean weighing scales', 'Check lighting and replace bulbs',
        'Clean and organize entrance area'
      ];

      for (let i = 0; i < frontItems.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [`front_${String(i + 1).padStart(3, '0')}`, 'front_template_001', frontItems[i], i + 1]);
      }

      // Barista template
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, ['barista_template_001', 'Barista Tasks', 'Coffee service and barista station maintenance', 'barista']);

      // Barista items
      const baristaItems = [
        'Clean espresso machine', 'Clean and calibrate grinder', 'Organize coffee station', 'Clean milk steaming equipment',
        'Check coffee bean supply', 'Clean cup and saucer storage', 'Wipe down barista station surfaces'
      ];

      for (let i = 0; i < baristaItems.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [`barista_${String(i + 1).padStart(3, '0')}`, 'barista_template_001', baristaItems[i], i + 1]);
      }

      console.log('✅ Verifying setup...');
      const templates = await client.query('SELECT count(*) FROM checklist_templates');
      const items = await client.query('SELECT count(*) FROM checklist_items');

      console.log(`📋 Created ${templates.rows[0].count} templates`);
      console.log(`📝 Created ${items.rows[0].count} checklist items`);

    } finally {
      client.release();
    }

    await pool.end();

    return createSuccessResponse({
      message: 'Checklist system setup completed successfully',
      steps: [
        '✅ Database connection established',
        '✅ Old tables dropped',
        '✅ Tables created with correct snake_case names',
        '✅ Indexes and foreign keys added',
        '✅ Kitchen tasks added (14 items)',
        '✅ Front of House tasks added (25 items)',
        '✅ Barista tasks added (7 items)',
        '📋 Ready to use at /checklists',
      ],
    });

  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return createErrorResponse('SETUP_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';