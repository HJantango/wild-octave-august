import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 CHECKLIST FIX - Direct PostgreSQL setup...');

    // Import Pool dynamically
    const { Pool } = await import('pg');
    
    const databaseUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL found:', !!databaseUrl);
    
    if (!databaseUrl) {
      return Response.json({
        error: 'DATABASE_URL not found',
        env_keys: Object.keys(process.env).filter(k => k.includes('DATABASE'))
      }, { status: 500 });
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    
    try {
      console.log('🗑️ Dropping old tables...');
      await client.query('DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistItem" CASCADE;');
      await client.query('DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;');

      console.log('📊 Creating checklist_templates...');
      await client.query(`
        CREATE TABLE "checklist_templates" (
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

      console.log('📊 Creating checklist_items...');  
      await client.query(`
        CREATE TABLE "checklist_items" (
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

      console.log('📊 Creating checklist_completions...');
      await client.query(`
        CREATE TABLE "checklist_completions" (
            "id" TEXT NOT NULL,
            "item_id" TEXT NOT NULL,
            "date" DATE NOT NULL,
            "completed_by" TEXT,
            "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "notes" TEXT,
            CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
        );
      `);

      // Add foreign keys
      await client.query(`
        ALTER TABLE "checklist_items" 
        ADD CONSTRAINT "checklist_items_template_id_fkey" 
        FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE;
      `);

      await client.query(`
        ALTER TABLE "checklist_completions" 
        ADD CONSTRAINT "checklist_completions_item_id_fkey" 
        FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE;
      `);

      console.log('🌱 Seeding kitchen template...');
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ('kitchen_001', 'Kitchen Tasks', 'Daily kitchen tasks', 'kitchen')
      `);

      // Add some kitchen items
      const kitchenTasks = ['Clean coffee machine', 'Wipe surfaces', 'Empty dishwasher', 'Clean sinks'];
      for (let i = 0; i < kitchenTasks.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, 'kitchen_001', $2, $3)
        `, [`k${i+1}`, kitchenTasks[i], i+1]);
      }

      console.log('🌱 Seeding front template...');
      await client.query(`
        INSERT INTO "checklist_templates" ("id", "name", "description", "section")
        VALUES ('front_001', 'Front Tasks', 'Customer area tasks', 'front')
      `);

      const frontTasks = ['Clean tables', 'Vacuum floors', 'Organize displays', 'Wipe payment terminal'];
      for (let i = 0; i < frontTasks.length; i++) {
        await client.query(`
          INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
          VALUES ($1, 'front_001', $2, $3)
        `, [`f${i+1}`, frontTasks[i], i+1]);
      }

      const templates = await client.query('SELECT count(*) FROM checklist_templates');
      const items = await client.query('SELECT count(*) FROM checklist_items');

      return Response.json({
        success: true,
        message: 'Checklist system created successfully!',
        stats: {
          templates: templates.rows[0].count,
          items: items.rows[0].count
        },
        next: 'Test at /api/checklists'
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';