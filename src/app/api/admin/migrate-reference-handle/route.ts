import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// Secret key for authenticated access
const ADMIN_SECRET = process.env.CRON_SECRET || 'wild-octave-sync-2024';

export async function POST(request: NextRequest) {
  try {
    // Check for secret key
    const providedKey = request.nextUrl.searchParams.get('key');
    if (providedKey !== ADMIN_SECRET) {
      return createErrorResponse('UNAUTHORIZED', 'Invalid admin key', 401);
    }

    console.log('🔧 Adding reference_handle columns...');

    // Add reference_handle column to items table
    await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "reference_handle" TEXT`;
    
    // Add reference_handle column to square_daily_sales table  
    await prisma.$executeRaw`ALTER TABLE "square_daily_sales" ADD COLUMN IF NOT EXISTS "reference_handle" TEXT`;
    
    // Add indexes for faster lookups
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_items_reference_handle" ON "items"("reference_handle")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_square_daily_sales_reference_handle" ON "square_daily_sales"("reference_handle")`;
    
    console.log('✅ Reference handle columns added successfully');

    return createSuccessResponse({
      message: 'Reference handle columns added to items and square_daily_sales tables',
      tablesUpdated: ['items', 'square_daily_sales'],
      indexesCreated: ['idx_items_reference_handle', 'idx_square_daily_sales_reference_handle'],
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return createErrorResponse(
      'MIGRATION_ERROR', 
      `Failed to add reference handle columns: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      500
    );
  }
}

export const dynamic = 'force-dynamic';