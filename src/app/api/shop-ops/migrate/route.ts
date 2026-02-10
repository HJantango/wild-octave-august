import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// POST /api/shop-ops/migrate - Create shop-ops tables directly via raw SQL
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-seed-key');
    if (authHeader !== 'wild-octave-2024') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    console.log('🔧 Running shop-ops migration...');

    // Create tables using raw SQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_ops_tasks" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL DEFAULT 'fridge',
        "asset" TEXT,
        "frequency_type" TEXT NOT NULL,
        "frequency_value" INTEGER NOT NULL DEFAULT 1,
        "estimated_minutes" INTEGER,
        "assigned_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "shop_ops_tasks_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_ops_schedules" (
        "id" TEXT NOT NULL,
        "task_id" TEXT NOT NULL,
        "due_date" DATE NOT NULL,
        "assigned_to" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "completed_at" TIMESTAMP(3),
        "completed_by" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "shop_ops_schedules_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_ops_completions" (
        "id" TEXT NOT NULL,
        "task_id" TEXT NOT NULL,
        "schedule_id" TEXT,
        "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_by" TEXT NOT NULL,
        "notes" TEXT,
        "photo_url" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "shop_ops_completions_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_ops_staff" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "phone" TEXT,
        "role" TEXT NOT NULL DEFAULT 'staff',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "shop_ops_staff_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_tasks_category_idx" ON "shop_ops_tasks"("category");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_tasks_is_active_idx" ON "shop_ops_tasks"("is_active");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "shop_ops_schedules_task_id_due_date_key" ON "shop_ops_schedules"("task_id", "due_date");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_schedules_due_date_idx" ON "shop_ops_schedules"("due_date");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_schedules_status_idx" ON "shop_ops_schedules"("status");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_completions_task_id_idx" ON "shop_ops_completions"("task_id");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_completions_completed_at_idx" ON "shop_ops_completions"("completed_at");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "shop_ops_completions_completed_by_idx" ON "shop_ops_completions"("completed_by");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "shop_ops_staff_name_key" ON "shop_ops_staff"("name");
    `);

    // Add foreign keys
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "shop_ops_schedules" ADD CONSTRAINT "shop_ops_schedules_task_id_fkey" 
        FOREIGN KEY ("task_id") REFERENCES "shop_ops_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "shop_ops_completions" ADD CONSTRAINT "shop_ops_completions_task_id_fkey" 
        FOREIGN KEY ("task_id") REFERENCES "shop_ops_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    return NextResponse.json({
      success: true,
      message: 'Shop-ops tables created successfully!',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Migration failed', details: String(error) } },
      { status: 500 }
    );
  }
}
