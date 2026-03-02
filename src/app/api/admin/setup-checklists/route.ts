import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Setting up checklist system...');

    // Run database migration
    try {
      console.log('📊 Running database migration...');
      await execAsync('npx prisma db push');
      console.log('✅ Database migration completed');
    } catch (error: any) {
      console.error('❌ Migration error:', error);
      return createErrorResponse('MIGRATION_ERROR', `Migration failed: ${error.message}`, 500);
    }

    // Run checklist seeding
    try {
      console.log('🌱 Seeding checklist data...');
      await execAsync('npx tsx prisma/seed-checklists.ts');
      console.log('✅ Checklist data seeded');
    } catch (error: any) {
      console.error('❌ Seed error:', error);
      return createErrorResponse('SEED_ERROR', `Seeding failed: ${error.message}`, 500);
    }

    return createSuccessResponse({
      message: 'Checklist system setup completed successfully',
      steps: [
        '✅ Database migration completed',
        '✅ Checklist templates created',
        '✅ Kitchen/Back tasks added (14 items)',
        '✅ Front of House tasks added (25 items)',
        '✅ Barista tasks added (7 items)',
        '📋 Ready to use at /checklists',
      ],
      nextSteps: [
        'Navigate to /checklists to view weekly tasks',
        'Use /checklists/manage to edit templates',
        'Staff can mark tasks as complete',
        'Print weekly layouts for lamination',
      ],
    });

  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return createErrorResponse('SETUP_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';