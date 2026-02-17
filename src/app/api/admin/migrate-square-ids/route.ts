import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

/**
 * Migration endpoint to add Square catalog ID fields to items table
 * and update the sync to use them
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'check';

    if (action === 'check') {
      // Check if migration is needed
      const result = await prisma.$queryRaw<any[]>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' 
        AND column_name IN ('square_catalog_id', 'square_variation_id')
      `;
      
      const hasColumns = result.length === 2;
      
      return createSuccessResponse({
        migrationNeeded: !hasColumns,
        existingColumns: result.map((r: any) => r.column_name),
        message: hasColumns 
          ? 'Migration already applied' 
          : 'Migration needed - POST with action: "migrate"',
      });
    }

    if (action === 'migrate') {
      // Add the columns if they don't exist
      await prisma.$executeRaw`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS square_catalog_id VARCHAR(255) UNIQUE,
        ADD COLUMN IF NOT EXISTS square_variation_id VARCHAR(255)
      `;
      
      // Create index on square_catalog_id if not exists
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_items_square_catalog_id 
        ON items(square_catalog_id)
      `;
      
      return createSuccessResponse({
        success: true,
        message: 'Migration applied successfully. Square catalog ID fields added to items table.',
      });
    }

    return createErrorResponse('INVALID_ACTION', 'Use action: "check" or "migrate"', 400);
  } catch (error: any) {
    console.error('Migration error:', error);
    return createErrorResponse('MIGRATION_ERROR', error.message, 500);
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ action: 'check' }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';
