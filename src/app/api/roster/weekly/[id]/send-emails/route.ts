import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { sendRosterEmails, calculateTotalHours, generateRosterPDF } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get roster with all shifts and staff details
    const roster = await prisma.roster.findUnique({
      where: { id: params.id },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                baseHourlyRate: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!roster) {
      return NextResponse.json(
        { success: false, error: 'Roster not found' },
        { status: 404 }
      );
    }

    // Group shifts by staff member
    const staffShifts = new Map();
    
    roster.shifts.forEach(shift => {
      if (!shift.staff.isActive) return; // Skip inactive staff
      
      const staffId = shift.staff.id;
      if (!staffShifts.has(staffId)) {
        staffShifts.set(staffId, {
          id: shift.staff.id,
          name: shift.staff.name,
          email: shift.staff.email,
          shifts: []
        });
      }
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const shiftDate = new Date(roster.weekStartDate);
      shiftDate.setDate(shiftDate.getDate() + (shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1));
      
      staffShifts.get(staffId).shifts.push({
        day: dayNames[shift.dayOfWeek],
        date: shiftDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        startTime: shift.startTime,
        endTime: shift.endTime,
        role: shift.role,
        isBackupBarista: shift.isBackupBarista,
        notes: shift.notes
      });
    });

    // Convert to array and calculate total hours for each staff member
    const staffMembers = Array.from(staffShifts.values()).map(staff => ({
      ...staff,
      totalHours: calculateTotalHours(roster.shifts.filter(s => s.staffId === staff.id))
    }));

    // Filter out staff without email addresses for the count
    const staffWithEmail = staffMembers.filter(staff => staff.email);
    const staffWithoutEmail = staffMembers.filter(staff => !staff.email);

    if (staffWithEmail.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No staff members have email addresses configured',
        details: {
          totalStaff: staffMembers.length,
          staffWithoutEmail: staffWithoutEmail.map(s => s.name)
        }
      });
    }

    // Generate roster PDF
    let rosterPdfBuffer: Buffer | undefined;
    try {
      // Get staff data for PDF generation
      const staff = await prisma.staff.findMany({
        where: { isActive: true }
      });
      
      rosterPdfBuffer = await generateRosterPDF({
        roster,
        staff,
        weekStartDate: roster.weekStartDate
      });
      
      console.log('📄 Roster PDF generated successfully');
    } catch (error) {
      console.error('Failed to generate roster PDF:', error);
      // Continue without PDF if generation fails
    }

    // Send emails
    const emailResults = await sendRosterEmails(
      roster.weekStartDate.toISOString().split('T')[0],
      staffWithEmail,
      rosterPdfBuffer
    );

    // Count successful and failed emails
    const successful = emailResults.filter(r => r.success);
    const failed = emailResults.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      message: `Roster emails sent successfully to ${successful.length} staff member${successful.length !== 1 ? 's' : ''}`,
      details: {
        totalStaff: staffMembers.length,
        emailsSent: successful.length,
        emailsFailed: failed.length,
        staffWithoutEmail: staffWithoutEmail.length,
        results: emailResults,
        staffWithoutEmailList: staffWithoutEmail.map(s => s.name)
      }
    });

  } catch (error) {
    console.error('Error sending roster emails:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send roster emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}