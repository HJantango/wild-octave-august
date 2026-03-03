import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// CREATE new checklist template
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

      // Generate template ID
      const templateId = `${section}_template_${Date.now()}`;

      // Create template
      await client.query(`
        INSERT INTO checklist_templates (id, name, description, section)
        VALUES ($1, $2, $3, $4)
      `, [templateId, name, description || null, section]);

      // Insert items
      for (let i = 0; i < (items || []).length; i++) {
        const item = items[i];
        const itemId = `${section}_${String(i + 1).padStart(3, '0')}_${Date.now()}`;
        
        // Handle frequency and specific days
        let frequency = item.frequency || 'daily';
        let specificDays = item.specificDays || [];
        
        // Convert 'specific_days' frequency to 'weekly' for storage
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

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching checklists with direct database connection...');
    
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    // Import Pool dynamically
    const { Pool } = await import('pg');
    
    // Get DATABASE_URL with fallback
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
      // Build section filter
      let sectionFilter = '';
      let params: any[] = [];
      if (section) {
        sectionFilter = 'AND t.section = $1';
        params.push(section);
      }

      // Fetch templates
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
        
        // Convert database fields to frontend format
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

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Checklist fetch error:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}



export const dynamic = 'force-dynamic';