import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { generateRosterImage } from '@/lib/roster-image-generator';
import {
  sendRosterSMSBatch,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '@/lib/sms-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch the roster with all shifts and staff
    const roster = await prisma.roster.findUnique({
      where: {
        id: params.id,
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
                baseHourlyRate: true,
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

    // Get all staff members from the database for the roster preview
    const allStaff = await prisma.rosterStaff.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        baseHourlyRate: true,
        isActive: true,
      },
    });

    // Get unique staff who have shifts in this roster
    const staffWithShifts = roster.shifts
      .map((shift) => shift.staff)
      .filter((staff, index, self) =>
        index === self.findIndex((s) => s.id === staff.id)
      );

    // Filter to only staff with valid phone numbers
    const staffWithPhones = staffWithShifts.filter(
      (staff) => staff.phone && isValidPhoneNumber(staff.phone)
    );

    if (staffWithPhones.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No staff members with valid phone numbers found for this roster',
        details: {
          totalStaffWithShifts: staffWithShifts.length,
          staffWithValidPhones: 0,
        },
      });
    }

    // Generate the roster image
    console.log('🖼️  Generating roster image...');
    const weekStartDate = new Date(roster.weekStartDate);

    const rosterImageBuffer = await generateRosterImage(
      {
        id: roster.id,
        weekStartDate: roster.weekStartDate.toISOString(),
        status: roster.status,
        shifts: roster.shifts.map((shift) => ({
          id: shift.id,
          staffId: shift.staffId,
          dayOfWeek: shift.dayOfWeek,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          notes: shift.notes || undefined,
          role: shift.role || undefined,
          isBackupBarista: shift.isBackupBarista || undefined,
          staff: {
            id: shift.staff.id,
            name: shift.staff.name,
            role: shift.staff.role,
            baseHourlyRate: Number(shift.staff.baseHourlyRate),
            isActive: shift.staff.isActive,
          },
        })),
      },
      allStaff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        baseHourlyRate: Number(s.baseHourlyRate),
        isActive: s.isActive,
      })),
      weekStartDate
    );

    console.log(`✅ Roster image generated (${rosterImageBuffer.length} bytes)`);

    // Prepare recipients
    const recipients = staffWithPhones.map((staff) => ({
      phone: normalizePhoneNumber(staff.phone!),
      name: staff.name,
    }));

    console.log(`📱 Sending SMS to ${recipients.length} staff members...`);

    // Send SMS messages
    const smsResults = await sendRosterSMSBatch(
      recipients,
      rosterImageBuffer,
      weekStartDate
    );

    // Count successes and failures
    const successful = smsResults.filter((r) => r.success).length;
    const failed = smsResults.filter((r) => !r.success).length;

    console.log(`✅ SMS sending complete: ${successful} sent, ${failed} failed`);

    // Update roster metadata to track SMS sending
    await prisma.roster.update({
      where: { id: roster.id },
      data: {
        updatedAt: new Date(), // Track when SMS was last sent
      },
    });

    return NextResponse.json({
      success: true,
      message: `Roster SMS sent to ${successful} staff member${successful !== 1 ? 's' : ''}`,
      details: {
        totalStaffWithShifts: staffWithShifts.length,
        staffWithValidPhones: staffWithPhones.length,
        smsSent: successful,
        smsFailed: failed,
        results: smsResults,
      },
    });
  } catch (error) {
    console.error('Error sending roster SMS:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send roster SMS',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
