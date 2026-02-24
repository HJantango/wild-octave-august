import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { generateRosterImage } from '@/lib/roster-image-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: { rosterId: string } }
) {
  try {
    const rosterId = params.rosterId;

    // Fetch the roster with all shifts and staff
    const roster = await prisma.roster.findUnique({
      where: {
        id: rosterId,
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
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    // Get all staff members for the roster preview
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

    console.log(`🖼️  Generating roster image for ${rosterId}...`);
    const weekStartDate = new Date(roster.weekStartDate);

    // Generate the roster image
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

    // Return the image with proper headers
    return new NextResponse(rosterImageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': rosterImageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Disposition': `inline; filename="roster-${weekStartDate.toISOString().split('T')[0]}.png"`,
      },
    });

  } catch (error) {
    console.error('Error generating roster image:', error);
    return NextResponse.json(
      { error: 'Failed to generate roster image' },
      { status: 500 }
    );
  }
}