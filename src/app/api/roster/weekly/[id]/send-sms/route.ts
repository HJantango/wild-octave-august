import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
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
    // Parse request body for custom message - simplified and safer
    let customMessage = null;
    
    if (request.headers.get('content-length') !== '0') {
      try {
        const body = await request.json();
        if (body && typeof body.customMessage === 'string') {
          customMessage = body.customMessage.trim() || null;
        }
      } catch (jsonError) {
        console.warn('Failed to parse SMS request body, continuing without custom message:', jsonError);
      }
    }
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

    // Prepare recipients
    const recipients = staffWithPhones.map((staff) => ({
      phone: normalizePhoneNumber(staff.phone!),
      name: staff.name,
    }));

    const weekStartDate = new Date(roster.weekStartDate);
    console.log(`📱 Sending MMS with roster image to ${recipients.length} staff members...`);

    // Send MMS messages with roster image
    const smsResults = await sendRosterSMSBatch(
      recipients,
      roster.id, // Pass roster ID instead of image buffer
      weekStartDate,
      customMessage
    );

    // Count successes and failures
    const successful = smsResults.filter((r) => r.success).length;
    const failed = smsResults.filter((r) => !r.success).length;

    console.log(`✅ SMS sending complete: ${successful} sent, ${failed} failed`);

    // Update roster metadata to track SMS sending (optional)
    try {
      await prisma.roster.update({
        where: { id: roster.id },
        data: {
          updatedAt: new Date(), // Track when SMS was last sent
        },
      });
    } catch (error) {
      // Don't fail the whole SMS operation if we can't update the timestamp
      console.warn('Could not update roster timestamp:', error);
    }

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
