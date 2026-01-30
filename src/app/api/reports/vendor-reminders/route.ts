import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

/**
 * GET /api/reports/vendor-reminders
 * 
 * Returns vendor orders that are due today with upcoming deadlines.
 * 
 * Query params:
 *   - hoursAhead: How many hours ahead to look for deadlines (default: 2)
 *   - includeNoDeadline: Include orders with no specific deadline (default: false)
 */

interface VendorReminder {
  vendorId: string;
  vendorName: string;
  orderDay: string;
  orderDeadline: string | null;
  deadlineTimeRemaining: string | null;
  minutesUntilDeadline: number | null;
  deliveryDay: string | null;
  frequency: string;
  notes: string | null;
  isOverdue: boolean;
  priority: 'urgent' | 'soon' | 'today' | 'upcoming';
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDeadlineTime(deadline: string): { hour: number; minute: number } | null {
  // Parse formats like "11:00 AM", "2:30 PM"
  const match = deadline.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  
  return { hour, minute };
}

function getMinutesUntilDeadline(deadline: string, nowAEDT: Date): number {
  const parsed = parseDeadlineTime(deadline);
  if (!parsed) return Infinity;
  
  const deadlineDate = new Date(nowAEDT);
  deadlineDate.setHours(parsed.hour, parsed.minute, 0, 0);
  
  return Math.floor((deadlineDate.getTime() - nowAEDT.getTime()) / (1000 * 60));
}

function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) return 'Overdue';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getPriority(minutes: number | null, isOverdue: boolean): VendorReminder['priority'] {
  if (isOverdue) return 'urgent';
  if (minutes === null) return 'today'; // No deadline, but due today
  if (minutes <= 30) return 'urgent';
  if (minutes <= 120) return 'soon';
  return 'today';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursAhead = parseInt(searchParams.get('hoursAhead') || '2');
    const includeNoDeadline = searchParams.get('includeNoDeadline') === 'true';
    const includeAll = searchParams.get('includeAll') === 'true';
    
    // Get current time in AEDT (UTC+11)
    const now = new Date();
    const aedtOffset = 11 * 60 * 60 * 1000;
    const nowAEDT = new Date(now.getTime() + aedtOffset);
    const todayDayName = DAYS_OF_WEEK[nowAEDT.getDay()];
    
    // Fetch active schedules for today
    const schedules = await prisma.vendorOrderSchedule.findMany({
      where: {
        isActive: true,
        orderDay: todayDayName,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    const reminders: VendorReminder[] = [];
    
    for (const schedule of schedules) {
      let minutesUntilDeadline: number | null = null;
      let isOverdue = false;
      
      if (schedule.orderDeadline) {
        minutesUntilDeadline = getMinutesUntilDeadline(schedule.orderDeadline, nowAEDT);
        isOverdue = minutesUntilDeadline < 0;
        
        // Skip if deadline is too far ahead (unless includeAll)
        if (!includeAll && !isOverdue && minutesUntilDeadline > hoursAhead * 60) {
          continue;
        }
      } else if (!includeNoDeadline && !includeAll) {
        // Skip orders with no deadline unless requested
        continue;
      }
      
      reminders.push({
        vendorId: schedule.vendorId,
        vendorName: schedule.vendor.name,
        orderDay: schedule.orderDay,
        orderDeadline: schedule.orderDeadline,
        deadlineTimeRemaining: minutesUntilDeadline !== null 
          ? formatTimeRemaining(minutesUntilDeadline)
          : null,
        minutesUntilDeadline,
        deliveryDay: schedule.deliveryDay,
        frequency: schedule.frequency,
        notes: schedule.notes,
        isOverdue,
        priority: getPriority(minutesUntilDeadline, isOverdue),
      });
    }
    
    // Sort by urgency: overdue first, then by minutes until deadline
    reminders.sort((a, b) => {
      // Overdue first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      
      // Then by minutes until deadline (null = no deadline = last)
      const aMin = a.minutesUntilDeadline ?? Infinity;
      const bMin = b.minutesUntilDeadline ?? Infinity;
      return aMin - bMin;
    });
    
    return createSuccessResponse({
      timestamp: nowAEDT.toISOString(),
      timezone: 'AEDT (UTC+11)',
      today: todayDayName,
      hoursAhead,
      reminders,
      summary: {
        total: reminders.length,
        overdue: reminders.filter(r => r.isOverdue).length,
        urgent: reminders.filter(r => r.priority === 'urgent').length,
        soon: reminders.filter(r => r.priority === 'soon').length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching vendor reminders:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      `Failed to fetch vendor reminders: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
