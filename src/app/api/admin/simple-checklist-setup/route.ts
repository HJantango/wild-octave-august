import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { Pool } from 'pg';

export async function POST(request: NextRequest) {
  let pool: Pool | undefined;
  
  try {
    console.log('🚀 Setting up checklist system with direct PostgreSQL...');

    // Get DATABASE_URL from Railway environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return createErrorResponse('ENV_ERROR', 'DATABASE_URL environment variable not found', 500);
    }

    // Create direct PostgreSQL connection
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('📊 Creating database tables...');
    
    const client = await pool.connect();
    
    try {
      // Drop old tables if they exist (wrong names)
      await client.query('DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistItem" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;');

      // Create tables with correct snake_case names
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

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_templates_section_idx" ON "checklist_templates"("section");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_templates_is_active_idx" ON "checklist_templates"("is_active");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_template_id_idx" ON "checklist_items"("template_id");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_frequency_idx" ON "checklist_items"("frequency");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_items_sort_order_idx" ON "checklist_items"("sort_order");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_completions_item_id_idx" ON "checklist_completions"("item_id");');
      await client.query('CREATE INDEX IF NOT EXISTS "checklist_completions_date_idx" ON "checklist_completions"("date");');
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "checklist_completions_item_id_date_key" ON "checklist_completions"("item_id", "date");');

      // Add foreign keys
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "checklist_items" 
          ADD CONSTRAINT "checklist_items_template_id_fkey" 
          FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "checklist_completions" 
          ADD CONSTRAINT "checklist_completions_item_id_fkey" 
          FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      console.log('✅ Database tables created');

      // Seed data using direct SQL
      console.log('🌱 Seeding checklist data...');
      
      // Helper function to generate CUID-like IDs
      const generateId = () => 'c' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Kitchen template
      const kitchenTemplateId = generateId();
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [kitchenTemplateId, 'Kitchen & Back Tasks', 'Daily kitchen cleaning and maintenance tasks', 'kitchen']);

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
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [generateId(), kitchenTemplateId, kitchenItems[i], i + 1]);
      }

      // Front template
      const frontTemplateId = generateId();
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [frontTemplateId, 'Front of House Tasks', 'Customer-facing area maintenance', 'front']);

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
        'Check and straighten signage'
      ];

      for (let i = 0; i < frontItems.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [generateId(), frontTemplateId, frontItems[i], i + 1]);
      }

      // Barista template
      const baristaTemplateId = generateId();
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [baristaTemplateId, 'Barista Tasks', 'Coffee service maintenance', 'barista']);

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
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("id") DO NOTHING
        `, [generateId(), baristaTemplateId, baristaItems[i], i + 1]);
      }

      console.log('✅ Checklist data seeded');

    } finally {
      client.release();
    }

    return createSuccessResponse({
      message: 'Checklist system setup completed successfully',
      steps: [
        '✅ Database connection established',
        '✅ Tables created with correct names',
        '✅ Kitchen tasks added (14 items)',
        '✅ Front of House tasks added (10 items)', 
        '✅ Barista tasks added (7 items)',
        '📋 Ready to use at /checklists',
      ],
    });

  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return createErrorResponse('SETUP_ERROR', error.message, 500);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export const dynamic = 'force-dynamic';