const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupChecklists() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🚀 Connecting to Railway database...');
    const client = await pool.connect();
    
    console.log('📊 Reading SQL script...');
    const sqlScript = fs.readFileSync(path.join(__dirname, 'checklist-setup.sql'), 'utf8');
    
    console.log('🔧 Executing checklist setup...');
    await client.query(sqlScript);
    
    console.log('✅ Checklist system setup completed!');
    
    // Verify
    const templates = await client.query('SELECT count(*) FROM checklist_templates');
    const items = await client.query('SELECT count(*) FROM checklist_items');
    
    console.log(`📋 Created ${templates.rows[0].count} templates`);
    console.log(`📝 Created ${items.rows[0].count} checklist items`);
    
    client.release();
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupChecklists();