import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Check if we can query the roster_staff table and what columns exist
    const sampleStaff = await prisma.rosterStaff.findFirst({
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true
      }
    });

    // Get all staff to see who has phones
    const allStaff = await prisma.rosterStaff.findMany({
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    // Count staff with phones vs without
    const withPhones = allStaff.filter(s => s.phone).length;
    const withoutPhones = allStaff.filter(s => !s.phone).length;

    // Try a raw query to check the actual database schema
    let rawSchemaInfo = null;
    try {
      const schemaQuery = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'roster_staff' 
        AND column_name IN ('phone', 'email')
        ORDER BY column_name;
      `;
      rawSchemaInfo = schemaQuery;
    } catch (e) {
      rawSchemaInfo = { error: e instanceof Error ? e.message : 'Schema query failed' };
    }

    return NextResponse.json({
      success: true,
      database: {
        connected: true,
        sampleStaff,
        staffCount: allStaff.length,
        withPhones,
        withoutPhones,
        staffWithPhones: allStaff.filter(s => s.phone).map(s => ({ name: s.name, phone: s.phone })),
        rawSchemaInfo
      }
    });

  } catch (error) {
    console.error('Database schema check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      connected: false
    }, { status: 500 });
  }
}