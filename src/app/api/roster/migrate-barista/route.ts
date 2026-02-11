import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// Migration endpoint to add canDoBarista column
export async function POST(request: NextRequest) {
  try {
    // Check if column exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT can_do_barista FROM roster_staff LIMIT 1`;
      return NextResponse.json({
        success: true,
        message: 'Column can_do_barista already exists',
      });
    } catch (e) {
      // Column doesn't exist, create it
    }

    // Add the column
    await prisma.$executeRaw`ALTER TABLE roster_staff ADD COLUMN can_do_barista BOOLEAN DEFAULT false`;

    return NextResponse.json({
      success: true,
      message: 'Column can_do_barista added successfully',
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
