import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking database status...');

    // Import Pool dynamically
    const { Pool } = await import('pg');
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: 'DATABASE_URL not found' }, { status: 500 });
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    
    try {
      // Check what tables exist
      const tables = await client.query(`
        SELECT table_name, table_schema 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      // Check for checklist tables specifically
      const checklistTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%checklist%'
        ORDER BY table_name;
      `);

      // Check migration status table
      let migrationStatus = null;
      try {
        const migrations = await client.query(`
          SELECT migration_name, finished_at 
          FROM "_prisma_migrations" 
          ORDER BY finished_at DESC 
          LIMIT 10;
        `);
        migrationStatus = migrations.rows;
      } catch (e) {
        migrationStatus = 'Migration table not found';
      }

      return Response.json({
        database: 'connected',
        totalTables: tables.rows.length,
        allTables: tables.rows.map(r => r.table_name),
        checklistTables: checklistTables.rows.map(r => r.table_name),
        migrationStatus,
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Database check error:', error);
    return Response.json({
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';