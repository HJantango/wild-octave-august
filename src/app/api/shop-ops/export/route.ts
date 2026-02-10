import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/shop-ops/export - Export schedules as iCal for Google Calendar
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'ical';
    const assignedTo = searchParams.get('assignedTo');
    const monthsAhead = parseInt(searchParams.get('months') || '3');

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate());

    const whereClause: Record<string, unknown> = {
      dueDate: {
        gte: now,
        lte: endDate,
      },
      status: { not: 'completed' },
    };

    if (assignedTo) {
      whereClause.assignedTo = assignedTo;
    }

    const schedules = await prisma.shopOpsSchedule.findMany({
      where: whereClause,
      include: {
        task: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    if (format === 'ical') {
      // Generate iCal format
      const icalContent = generateIcal(schedules, assignedTo);
      
      return new NextResponse(icalContent, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="shop-ops-${assignedTo || 'all'}.ics"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error('Error exporting schedules:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to export schedules' } },
      { status: 500 }
    );
  }
}

interface ScheduleWithTask {
  id: string;
  dueDate: Date;
  assignedTo: string | null;
  notes: string | null;
  task: {
    name: string;
    description: string | null;
    category: string;
    asset: string | null;
    estimatedMinutes: number | null;
  };
}

function generateIcal(schedules: ScheduleWithTask[], assignedTo: string | null): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wild Octave//Shop Ops//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Shop Ops${assignedTo ? ` - ${assignedTo}` : ''}`,
  ];

  for (const schedule of schedules) {
    const dueDate = new Date(schedule.dueDate);
    const dateStr = formatIcalDate(dueDate);
    const uid = `${schedule.id}@wild-octave-shop-ops`;
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${dateStr}`);
    lines.push(`SUMMARY:${escapeIcal(schedule.task.name)}`);
    
    const description: string[] = [];
    if (schedule.task.description) {
      description.push(schedule.task.description);
    }
    if (schedule.task.asset) {
      description.push(`Asset: ${schedule.task.asset}`);
    }
    if (schedule.task.estimatedMinutes) {
      description.push(`Estimated time: ${schedule.task.estimatedMinutes} minutes`);
    }
    if (schedule.notes) {
      description.push(`Notes: ${schedule.notes}`);
    }
    
    if (description.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcal(description.join('\\n'))}`);
    }
    
    lines.push(`CATEGORIES:${schedule.task.category.toUpperCase()}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatIcalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
