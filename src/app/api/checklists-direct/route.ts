import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Attempting direct database connection...');
    
    // Import Pool dynamically to avoid initialization issues
    const { Pool } = await import('pg');
    
    // Get DATABASE_URL - try multiple sources
    let databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      // Try alternative environment variable names
      const altNames = ['DB_URL', 'POSTGRES_URL', 'POSTGRESQL_URL'];
      for (const name of altNames) {
        if (process.env[name]) {
          databaseUrl = process.env[name];
          break;
        }
      }
    }
    
    if (!databaseUrl) {
      // Hardcode Railway connection for testing (not ideal but temporary)
      databaseUrl = 'postgresql://postgres:zzMDCkxGEZsoQWhtsLkhlXrAVgRyytTQ@postgres.railway.internal:5432/railway';
    }

    console.log('📊 Database URL found:', !!databaseUrl);
    console.log('📊 Database URL start:', databaseUrl?.substring(0, 30));

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('📊 Connecting to database...');
    const client = await pool.connect();
    
    try {
      // Fetch checklist templates with items
      const templatesQuery = `
        SELECT 
          t.id,
          t.name,
          t.description,
          t.section,
          t.is_active,
          t.created_at,
          t.updated_at
        FROM checklist_templates t
        WHERE t.is_active = true
        ORDER BY t.name ASC
      `;
      
      const templates = await client.query(templatesQuery);
      
      // Fetch items for each template
      const result = [];
      for (const template of templates.rows) {
        const itemsQuery = `
          SELECT 
            id,
            title,
            description,
            frequency,
            specific_days,
            sort_order,
            is_active,
            created_at,
            updated_at
          FROM checklist_items
          WHERE template_id = $1 AND is_active = true
          ORDER BY sort_order ASC
        `;
        
        const items = await client.query(itemsQuery, [template.id]);
        
        result.push({
          ...template,
          items: items.rows
        });
      }
      
      console.log(`✅ Fetched ${result.length} templates with items`);
      
      return Response.json({
        data: result,
        success: true,
        meta: {
          totalTemplates: result.length,
          totalItems: result.reduce((sum, t) => sum + t.items.length, 0),
          source: 'direct_database_connection',
          timestamp: new Date().toISOString()
        }
      });

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Direct checklist fetch error:', error);
    return Response.json({
      error: {
        code: 'DIRECT_FETCH_ERROR',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';