import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching checklists with direct database connection...');
    
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    // Try to import pg
    let Pool;
    try {
      const pgModule = await import('pg');
      Pool = pgModule.Pool;
    } catch (pgError: any) {
      console.error('❌ Failed to import pg:', pgError);
      return createErrorResponse('PG_IMPORT_ERROR', 'PostgreSQL module not available', 500);
    }
    
    let databaseUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL available:', !!databaseUrl);
    
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
      // First, check if tables exist
      try {
        await client.query('SELECT 1 FROM checklist_templates LIMIT 1');
        console.log('✅ Tables exist');
      } catch (tableError: any) {
        console.error('❌ Tables missing:', tableError);
        client.release();
        await pool.end();
        
        // Return fallback data if tables don't exist
        return createSuccessResponse([
          {
            id: 'kitchen_template_fallback',
            name: 'Kitchen & Back Tasks',
            section: 'kitchen',
            items: [
              { id: 'k1', title: 'Clean cooking utensils', frequency: 'daily', specificDays: [] },
              { id: 'k2', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [] },
              { id: 'k3', title: 'Clean all surfaces', frequency: 'daily', specificDays: [] }
            ]
          },
          {
            id: 'front_template_fallback',
            name: 'Front of House Tasks', 
            section: 'front',
            items: [
              { id: 'f1', title: 'Clean bulk section', frequency: 'daily', specificDays: [] },
              { id: 'f2', title: 'Restock drinks fridge', frequency: 'daily', specificDays: [] },
              { id: 'f3', title: 'Clean toilets', frequency: 'weekly', specificDays: ['Wednesday', 'Saturday'] }
            ]
          }
        ]);
      }

      let sectionFilter = '';
      let params: any[] = [];
      if (section) {
        sectionFilter = 'AND t.section = $1';
        params.push(section);
      }

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
        WHERE t.is_active = true ${sectionFilter}
        ORDER BY t.name ASC
      `;
      
      const templates = await client.query(templatesQuery, params);
      console.log(`Found ${templates.rows.length} templates`);
      
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
        
        const convertedItems = items.rows.map(item => ({
          ...item,
          specificDays: item.specific_days ? JSON.parse(item.specific_days) : []
        }));
        
        result.push({
          ...template,
          items: convertedItems
        });
      }
      
      console.log(`✅ Fetched ${result.length} templates with ${result.reduce((sum, t) => sum + t.items.length, 0)} items`);
      
      return createSuccessResponse(result);

    } catch (queryError: any) {
      console.error('❌ Database query error:', queryError);
      client.release();
      await pool.end();
      return createErrorResponse('QUERY_ERROR', `Database query failed: ${queryError.message}`, 500);
    } finally {
      if (client) client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Checklist fetch error:', error);
    console.error('Error stack:', error.stack);
    return createErrorResponse('FETCH_ERROR', `API error: ${error.message}`, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, section, items } = body;

    if (!name || !section) {
      return createErrorResponse('VALIDATION_ERROR', 'Name and section are required', 400);
    }

    const { Pool } = await import('pg');
    
    let databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      databaseUrl = 'postgresql://postgres:zzMDCkxGEZsoQWhtsLkhlXrAVgRyytTQ@postgres.railway.internal:5432/railway';
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const templateId = `${section}_template_${Date.now()}`;

      await client.query(`
        INSERT INTO checklist_templates (id, name, description, section)
        VALUES ($1, $2, $3, $4)
      `, [templateId, name, description || null, section]);

      for (let i = 0; i < (items || []).length; i++) {
        const item = items[i];
        const itemId = `${section}_${String(i + 1).padStart(3, '0')}_${Date.now()}`;
        
        let frequency = item.frequency || 'daily';
        let specificDays = item.specificDays || [];
        
        if (frequency === 'specific_days' && specificDays.length > 0) {
          frequency = 'weekly';
        }
        
        await client.query(`
          INSERT INTO checklist_items 
          (id, template_id, title, description, frequency, specific_days, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          itemId,
          templateId,
          item.title,
          item.description || null,
          frequency,
          JSON.stringify(specificDays),
          i + 1
        ]);
      }

      await client.query('COMMIT');
      return createSuccessResponse({ id: templateId, message: 'Checklist created successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Error creating checklist:', error);
    return createErrorResponse('CREATE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';