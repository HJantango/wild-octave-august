const { Pool } = require('pg');

console.log('🚀 Updating checklist data with comprehensive items...');

async function updateChecklistData() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Clear existing items (but keep templates)
    await client.query('DELETE FROM checklist_items');
    console.log('🗑️ Cleared existing items');

    // Add comprehensive Kitchen & Back Tasks
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

    // Add comprehensive Front of House Tasks  
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

    // Add Barista Tasks
    const baristaItems = [
      'Clean espresso machine',
      'Clean and calibrate grinder',
      'Organize coffee station',
      'Clean milk steaming equipment',
      'Check coffee bean supply',
      'Clean cup and saucer storage',
      'Wipe down barista station surfaces'
    ];

    // Insert Kitchen items
    for (let i = 0; i < kitchenItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, 'kitchen_001', $2, $3)
      `, [`kitchen_${String(i + 1).padStart(3, '0')}`, kitchenItems[i], i + 1]);
    }
    console.log(`✅ Added ${kitchenItems.length} kitchen items`);

    // Insert Front items
    for (let i = 0; i < frontItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, 'front_001', $2, $3)
      `, [`front_${String(i + 1).padStart(3, '0')}`, frontItems[i], i + 1]);
    }
    console.log(`✅ Added ${frontItems.length} front items`);

    // Insert Barista items
    for (let i = 0; i < baristaItems.length; i++) {
      await client.query(`
        INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order")
        VALUES ($1, 'barista_001', $2, $3)
      `, [`barista_${String(i + 1).padStart(3, '0')}`, baristaItems[i], i + 1]);
    }
    console.log(`✅ Added ${baristaItems.length} barista items`);

    // Verify
    const templateCount = await client.query('SELECT COUNT(*) FROM checklist_templates');
    const itemCount = await client.query('SELECT COUNT(*) FROM checklist_items');
    
    console.log('✅ Update complete!');
    console.log(`📊 Templates: ${templateCount.rows[0].count}`);
    console.log(`📊 Items: ${itemCount.rows[0].count}`);
    console.log(`📊 Total: ${kitchenItems.length + frontItems.length + baristaItems.length} items`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

updateChecklistData();