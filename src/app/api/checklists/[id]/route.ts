import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET single checklist template
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
      // Fetch template
      const templateQuery = `
        SELECT * FROM checklist_templates 
        WHERE id = $1 AND is_active = true
      `;
      const template = await client.query(templateQuery, [params.id]);
      
      if (template.rows.length === 0) {
        return createErrorResponse('NOT_FOUND', 'Checklist not found', 404);
      }

      // Fetch items
      const itemsQuery = `
        SELECT * FROM checklist_items 
        WHERE template_id = $1 AND is_active = true 
        ORDER BY sort_order ASC
      `;
      const items = await client.query(itemsQuery, [params.id]);

      // Convert database fields to frontend format
      const convertedItems = items.rows.map(item => ({
        ...item,
        specificDays: item.specific_days ? JSON.parse(item.specific_days) : []
      }));

      const result = {
        ...template.rows[0],
        items: convertedItems
      };

      return createSuccessResponse(result);

    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Error fetching checklist:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}

// UPDATE checklist template
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, description, section, items } = body;

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

      // Update template
      await client.query(`
        UPDATE checklist_templates 
        SET name = $1, description = $2, section = $3, updated_at = NOW()
        WHERE id = $4
      `, [name, description || null, section, params.id]);

      // Delete existing items
      await client.query('DELETE FROM checklist_items WHERE template_id = $1', [params.id]);

      // Insert new items
      for (let i = 0; i < items.length; i++) {
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
          params.id,
          item.title,
          item.description || null,
          frequency,
          JSON.stringify(specificDays),
          i + 1
        ]);
      }

      await client.query('COMMIT');
      return createSuccessResponse({ id: params.id, message: 'Checklist updated successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Error updating checklist:', error);
    return createErrorResponse('UPDATE_ERROR', error.message, 500);
  }
}

// DELETE checklist template
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

      // Soft delete (set is_active = false) to preserve completion history
      await client.query(`
        UPDATE checklist_templates 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [params.id]);

      await client.query(`
        UPDATE checklist_items 
        SET is_active = false, updated_at = NOW()
        WHERE template_id = $1
      `, [params.id]);

      await client.query('COMMIT');
      return createSuccessResponse({ message: 'Checklist deleted successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }

  } catch (error: any) {
    console.error('❌ Error deleting checklist:', error);
    return createErrorResponse('DELETE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';