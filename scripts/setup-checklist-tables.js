const { Pool } = require('pg');

console.log('🚀 Setting up checklist tables directly...');

async function setupTables() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL found');
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Check existing tables
    const existingTables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%checklist%'
    `);
    
    console.log('📊 Existing checklist tables:', existingTables.rows.map(r => r.table_name));

    // Drop old tables if they exist
    await client.query('DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;');
    await client.query('DROP TABLE IF EXISTS "ChecklistItem" CASCADE;');
    await client.query('DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;');
    console.log('🗑️ Dropped old tables');

    // Create tables with correct names
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

    console.log('✅ Created base tables');

    // Add constraints
    await client.query(`
      ALTER TABLE "checklist_items" 
      DROP CONSTRAINT IF EXISTS "checklist_items_template_id_fkey";
    `);
    await client.query(`
      ALTER TABLE "checklist_items" 
      ADD CONSTRAINT "checklist_items_template_id_fkey" 
      FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE;
    `);

    await client.query(`
      ALTER TABLE "checklist_completions" 
      DROP CONSTRAINT IF EXISTS "checklist_completions_item_id_fkey";
    `);
    await client.query(`
      ALTER TABLE "checklist_completions" 
      ADD CONSTRAINT "checklist_completions_item_id_fkey" 
      FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE;
    `);

    console.log('✅ Added foreign key constraints');

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS "idx_checklist_templates_section" ON "checklist_templates"("section");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_checklist_items_template_id" ON "checklist_items"("template_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_checklist_completions_date" ON "checklist_completions"("date");');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_checklist_completions_unique" ON "checklist_completions"("item_id", "date");');
    
    console.log('✅ Added indexes');

    // Seed data
    console.log('🌱 Seeding initial data...');
    
    // Generate simple IDs
    const kitchenId = 'kitchen_template_001';
    const frontId = 'front_template_001'; 
    const baristaId = 'barista_template_001';

    await client.query(`
      INSERT INTO "checklist_templates" ("id", "name", "description", "section")
      VALUES 
        ($1, 'Kitchen & Back Tasks', 'Daily kitchen cleaning and maintenance', 'kitchen'),
        ($2, 'Front of House Tasks', 'Customer area maintenance', 'front'),
        ($3, 'Barista Tasks', 'Coffee service maintenance', 'barista')
      ON CONFLICT ("id") DO NOTHING
    `, [kitchenId, frontId, baristaId]);

    const kitchenItems = [
      'Wipe down all prep surfaces',
      'Clean coffee machine',
      'Empty dishwasher', 
      'Clean sinks',
      'Take out rubbish',
      'Clean microwave',
      'Organize storage'
    ];

    for (let i = 0; i < kitchenItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [`kitchen_${i + 1}`, kitchenId, kitchenItems[i], i + 1]);
    }

    const frontItems = [
      'Clean tables and chairs',
      'Vacuum floors',
      'Clean windows',
      'Organize displays',
      'Empty bins'
    ];

    for (let i = 0; i < frontItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [`front_${i + 1}`, frontId, frontItems[i], i + 1]);
    }

    const baristaItems = [
      'Clean espresso machine',
      'Clean grinder', 
      'Organize station',
      'Clean steam wand'
    ];

    for (let i = 0; i < baristaItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO NOTHING
      `, [`barista_${i + 1}`, baristaId, baristaItems[i], i + 1]);
    }

    // Verify
    const templateCount = await client.query('SELECT COUNT(*) FROM checklist_templates');
    const itemCount = await client.query('SELECT COUNT(*) FROM checklist_items');
    
    console.log('✅ Setup complete!');
    console.log(`📊 Templates: ${templateCount.rows[0].count}`);
    console.log(`📊 Items: ${itemCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupTables();