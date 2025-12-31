import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceRosterId, targetWeekStartDate } = body;

    if (!sourceRosterId || !targetWeekStartDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: sourceRosterId and targetWeekStartDate' 
        },
        { status: 400 }
      );
    }

    const targetDate = new Date(targetWeekStartDate);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid targetWeekStartDate format. Use YYYY-MM-DD' 
        },
        { status: 400 }
      );
    }

    // Get source roster with all shifts
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: sourceRosterId },
      include: {
        shifts: true
      }
    });

    if (!sourceRoster) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Source roster not found' 
        },
        { status: 404 }
      );
    }

    // Check if target roster already exists and delete it if it does
    const existingRoster = await prisma.roster.findUnique({
      where: { weekStartDate: targetDate }
    });

    if (existingRoster) {
      // Delete existing roster and its shifts (cascade will handle shifts)
      await prisma.roster.delete({
        where: { id: existingRoster.id }
      });
    }

    // Create new roster with duplicated shifts
    const newRoster = await prisma.roster.create({
      data: {
        weekStartDate: targetDate,
        status: 'draft', // Always create as draft
        shifts: {
          create: sourceRoster.shifts.map(shift => ({
            staffId: shift.staffId,
            dayOfWeek: shift.dayOfWeek,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes,
            role: shift.role,
            isBackupBarista: shift.isBackupBarista,
            notes: shift.notes
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
                isActive: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: newRoster,
      message: `Roster duplicated to ${targetWeekStartDate} successfully`
    });

  } catch (error) {
    console.error('Error duplicating roster:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to duplicate roster' 
      },
      { status: 500 }
    );
  }
}