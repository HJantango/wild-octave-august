import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Check roster staff count
    const staffCount = await prisma.rosterStaff.count();
    
    // Get all staff (just names and roles)
    const staff = await prisma.rosterStaff.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Check if there are any rosters
    const rosterCount = await prisma.roster.count();
    
    // Check shifts
    const shiftCount = await prisma.rosterShift.count();

    return NextResponse.json({
      staffCount,
      staff,
      rosterCount,
      shiftCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      code: error.code,
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
