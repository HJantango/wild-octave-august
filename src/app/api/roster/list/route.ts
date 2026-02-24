import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const rosters = await prisma.roster.findMany({
      select: {
        id: true,
        weekStartDate: true,
        status: true,
        createdAt: true,
        _count: {
          select: { shifts: true }
        }
      },
      orderBy: { weekStartDate: 'desc' },
      take: 10
    });

    return NextResponse.json({
      success: true,
      rosters: rosters.map(roster => ({
        id: roster.id,
        weekStartDate: roster.weekStartDate.toISOString().split('T')[0],
        status: roster.status,
        shiftsCount: roster._count.shifts,
        createdAt: roster.createdAt.toISOString()
      }))
    });

  } catch (error) {
    console.error('Error listing rosters:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list rosters'
    }, { status: 500 });
  }
}