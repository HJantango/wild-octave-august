import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');

    if (!weekParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing week parameter (YYYY-MM-DD format)' 
        },
        { status: 400 }
      );
    }

    const weekStartDate = new Date(weekParam);
    if (isNaN(weekStartDate.getTime())) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid week parameter format. Use YYYY-MM-DD' 
        },
        { status: 400 }
      );
    }

    // Find or create roster for the week
    let roster = await prisma.roster.findUnique({
      where: {
        weekStartDate: weekStartDate
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                role: true,
                baseHourlyRate: true,
                saturdayHourlyRate: true,
                sundayHourlyRate: true,
                publicHolidayHourlyRate: true,
                taxRate: true,
                superRate: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    // If no roster exists for this week, create one
    if (!roster) {
      roster = await prisma.roster.create({
        data: {
          weekStartDate: weekStartDate,
          status: 'draft'
        },
        include: {
          shifts: {
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  baseHourlyRate: true,
                  saturdayHourlyRate: true,
                  sundayHourlyRate: true,
                  publicHolidayHourlyRate: true,
                  taxRate: true,
                  superRate: true,
                  isActive: true
                }
              }
            }
          }
        }
      });
    }

    // Convert Decimal fields to numbers for JSON serialization
    const formattedRoster = {
      ...roster,
      weekStartDate: roster.weekStartDate.toISOString().split('T')[0],
      shifts: roster.shifts.map(shift => ({
        ...shift,
        staff: {
          ...shift.staff,
          baseHourlyRate: Number(shift.staff.baseHourlyRate),
          saturdayHourlyRate: shift.staff.saturdayHourlyRate ? Number(shift.staff.saturdayHourlyRate) : null,
          sundayHourlyRate: shift.staff.sundayHourlyRate ? Number(shift.staff.sundayHourlyRate) : null,
          publicHolidayHourlyRate: shift.staff.publicHolidayHourlyRate ? Number(shift.staff.publicHolidayHourlyRate) : null,
          taxRate: shift.staff.taxRate ?? 30,
          superRate: shift.staff.superRate
        }
      }))
    };

    return NextResponse.json({
      success: true,
      data: formattedRoster
    });

  } catch (error) {
    console.error('Error fetching weekly roster:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch roster data' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStartDate, shifts = [] }: { weekStartDate: string; shifts: unknown[] } = body;

    if (!weekStartDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: weekStartDate' 
        },
        { status: 400 }
      );
    }

    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid weekStartDate format. Use YYYY-MM-DD' 
        },
        { status: 400 }
      );
    }

    // Create roster with shifts
    const roster = await prisma.roster.create({
      data: {
        weekStartDate: startDate,
        status: 'draft',
        shifts: {
          create: shifts.map((shift: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            staffId: shift.staffId,
            dayOfWeek: shift.dayOfWeek,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes ?? 0,
            role: shift.role || null,
            isBackupBarista: shift.isBackupBarista || false,
            notes: shift.notes || null
          }))
        }
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                role: true,
                baseHourlyRate: true,
                saturdayHourlyRate: true,
                sundayHourlyRate: true,
                publicHolidayHourlyRate: true,
                taxRate: true,
                superRate: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    const formattedRoster = {
      ...roster,
      weekStartDate: roster.weekStartDate.toISOString().split('T')[0],
      shifts: roster.shifts.map(shift => ({
        ...shift,
        staff: {
          ...shift.staff,
          baseHourlyRate: Number(shift.staff.baseHourlyRate),
          saturdayHourlyRate: shift.staff.saturdayHourlyRate ? Number(shift.staff.saturdayHourlyRate) : null,
          sundayHourlyRate: shift.staff.sundayHourlyRate ? Number(shift.staff.sundayHourlyRate) : null,
          publicHolidayHourlyRate: shift.staff.publicHolidayHourlyRate ? Number(shift.staff.publicHolidayHourlyRate) : null,
          taxRate: shift.staff.taxRate ?? 30,
          superRate: shift.staff.superRate
        }
      }))
    };

    return NextResponse.json({
      success: true,
      data: formattedRoster
    });

  } catch (error: any) {
    console.error('Error creating weekly roster:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Roster for this week already exists' 
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create roster' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStartDate, shifts = [], status } = body;

    if (!weekStartDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: weekStartDate' 
        },
        { status: 400 }
      );
    }

    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid weekStartDate format. Use YYYY-MM-DD' 
        },
        { status: 400 }
      );
    }

    // Find existing roster
    const existingRoster = await prisma.roster.findUnique({
      where: { weekStartDate: startDate }
    });

    if (!existingRoster) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Roster not found for this week' 
        },
        { status: 404 }
      );
    }

    // Update roster and replace all shifts
    const roster = await prisma.roster.update({
      where: { weekStartDate: startDate },
      data: {
        ...(status !== undefined && { status }),
        shifts: {
          deleteMany: {}, // Remove all existing shifts
          create: shifts.map((shift: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            staffId: shift.staffId,
            dayOfWeek: shift.dayOfWeek,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes ?? 0,
            role: shift.role || null,
            isBackupBarista: shift.isBackupBarista || false,
            notes: shift.notes || null
          }))
        }
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                role: true,
                baseHourlyRate: true,
                saturdayHourlyRate: true,
                sundayHourlyRate: true,
                publicHolidayHourlyRate: true,
                taxRate: true,
                superRate: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    const formattedRoster = {
      ...roster,
      weekStartDate: roster.weekStartDate.toISOString().split('T')[0],
      shifts: roster.shifts.map(shift => ({
        ...shift,
        staff: {
          ...shift.staff,
          baseHourlyRate: Number(shift.staff.baseHourlyRate),
          saturdayHourlyRate: shift.staff.saturdayHourlyRate ? Number(shift.staff.saturdayHourlyRate) : null,
          sundayHourlyRate: shift.staff.sundayHourlyRate ? Number(shift.staff.sundayHourlyRate) : null,
          publicHolidayHourlyRate: shift.staff.publicHolidayHourlyRate ? Number(shift.staff.publicHolidayHourlyRate) : null,
          taxRate: shift.staff.taxRate ?? 30,
          superRate: shift.staff.superRate
        }
      }))
    };

    return NextResponse.json({
      success: true,
      data: formattedRoster
    });

  } catch (error) {
    console.error('Error updating weekly roster:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update roster' 
      },
      { status: 500 }
    );
  }
}