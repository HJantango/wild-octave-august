import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...');
    
    // Try to import pg
    let Pool;
    try {
      const pgModule = await import('pg');
      Pool = pgModule.Pool;
      console.log('✅ pg module imported successfully');
    } catch (pgError: any) {
      console.error('❌ Failed to import pg:', pgError);
      return createErrorResponse('PG_IMPORT_ERROR', 'PostgreSQL module not available', 500);
    }
    
    let databaseUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL available:', !!databaseUrl);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    if (!databaseUrl) {
      databaseUrl = 'postgresql://postgres:zzMDCkxGEZsoQWhtsLkhlXrAVgRyytTQ@postgres.railway.internal:5432/railway';
      console.log('Using fallback database URL');
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    let client;
    try {
      client = await pool.connect();
      console.log('✅ Database connection established');
    } catch (connError: any) {
      console.error('❌ Database connection failed:', connError);
      await pool.end();
      return createErrorResponse('DB_CONNECTION_ERROR', `Database connection failed: ${connError.message}`, 500);
    }

    try {
      // Test basic query
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      console.log('✅ Test query successful');
      
      // Test if our tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'checklist%'
        ORDER BY table_name
      `;
      const tables = await client.query(tablesQuery);
      console.log('Checklist tables found:', tables.rows.map(r => r.table_name));
      
      return createSuccessResponse({
        database_time: result.rows[0].current_time,
        database_version: result.rows[0].version,
        checklist_tables: tables.rows.map(r => r.table_name),
        connection_successful: true
      });

    } catch (queryError: any) {
      console.error('❌ Database query error:', queryError);
      return createErrorResponse('QUERY_ERROR', `Database query failed: ${queryError.message}`, 500);
    } finally {
      if (client) client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Test database error:', error);
    console.error('Error stack:', error.stack);
    return createErrorResponse('TEST_ERROR', `Test error: ${error.message}`, 500);
  }
}

export const dynamic = 'force-dynamic';