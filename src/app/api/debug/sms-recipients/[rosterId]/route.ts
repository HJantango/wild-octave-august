import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/sms-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { rosterId: string } }
) {
  try {
    // Fetch the roster with all shifts and staff
    const roster = await prisma.roster.findUnique({
      where: {
        id: params.rosterId,
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return NextResponse.json(
        { success: false, error: 'Roster not found' },
        { status: 404 }
      );
    }

    // Get unique staff who have shifts in this roster
    const staffWithShifts = roster.shifts
      .map((shift) => shift.staff)
      .filter((staff, index, self) =>
        index === self.findIndex((s) => s.id === staff.id)
      );

    // Analyze each staff member
    const staffAnalysis = staffWithShifts.map((staff) => {
      const hasPhone = !!staff.phone;
      const isValidPhone = hasPhone && isValidPhoneNumber(staff.phone);
      const normalizedPhone = isValidPhone ? normalizePhoneNumber(staff.phone!) : null;

      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        email: staff.email,
        phone: staff.phone,
        isActive: staff.isActive,
        hasPhone,
        isValidPhone,
        normalizedPhone,
        willReceiveSMS: isActive && hasPhone && isValidPhone,
        issues: [
          !staff.isActive && 'Staff is inactive',
          !hasPhone && 'No phone number set',
          hasPhone && !isValidPhone && 'Invalid phone format'
        ].filter(Boolean),
      };
    });

    const wouldReceiveSMS = staffAnalysis.filter(s => s.willReceiveSMS);

    return NextResponse.json({
      success: true,
      rosterId: params.rosterId,
      weekStartDate: roster.weekStartDate,
      analysis: {
        totalStaffWithShifts: staffAnalysis.length,
        wouldReceiveSMS: wouldReceiveSMS.length,
        staffDetails: staffAnalysis,
        recipients: wouldReceiveSMS.map(s => ({
          name: s.name,
          phone: s.normalizedPhone
        })),
        summary: {
          active: staffAnalysis.filter(s => s.isActive).length,
          withPhones: staffAnalysis.filter(s => s.hasPhone).length,
          validPhones: staffAnalysis.filter(s => s.isValidPhone).length,
        }
      }
    });

  } catch (error) {
    console.error('Error analyzing SMS recipients:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze SMS recipients',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}