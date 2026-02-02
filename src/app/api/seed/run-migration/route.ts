import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Run the migration SQL directly
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "assignees" TEXT[] DEFAULT ARRAY[]::TEXT[];
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "order_type" TEXT DEFAULT 'regular';
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "contact_method" TEXT;
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "trigger" TEXT;
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "order_deadline" TEXT;
    `);

    return createSuccessResponse({ 
      message: 'Migration completed - added columns to vendor_order_schedules' 
    });
  } catch (error: any) {
    console.error('Error running migration:', error);
    return createErrorResponse(
      'MIGRATION_ERROR',
      `Failed to run migration: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
