import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

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
        
        result.push({
          ...template,
          items: items.rows
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, section, items } = body;

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        description,
        section,
        items: {
          create: items?.map((item: any, index: number) => ({
            title: item.title,
            description: item.description,
            frequency: item.frequency || 'daily',
            specificDays: item.specificDays || [],
            sortOrder: index,
          })) || [],
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return createSuccessResponse(template);
  } catch (error: any) {
    console.error('Error creating checklist:', error);
    return createErrorResponse('CREATE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';