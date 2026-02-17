import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

const SYNC_SECRET = process.env.CRON_SECRET || 'wild-octave-sync-2024';

/**
 * Migration endpoint to add salary_type and weekly_salary columns
 */
export async function POST(request: NextRequest) {
  const providedKey = request.nextUrl.searchParams.get('key');
  if (providedKey !== SYNC_SECRET) {
    return createErrorResponse('UNAUTHORIZED', 'Invalid key', 401);
  }

  try {
    // Add the new columns using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE roster_staff 
      ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'hourly',
      ADD COLUMN IF NOT EXISTS weekly_salary DECIMAL(10,2) DEFAULT NULL
    `);

    return createSuccessResponse({
      success: true,
      message: 'Migration applied successfully. salary_type and weekly_salary columns added to roster_staff table.'
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return createErrorResponse('MIGRATION_ERROR', error.message, 500);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export const dynamic = 'force-dynamic';
