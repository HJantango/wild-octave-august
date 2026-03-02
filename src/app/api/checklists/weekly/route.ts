import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

function getWeekDates(weekStart: Date) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function shouldShowItemForDay(item: any, dayName: string): boolean {
  switch (item.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return dayName === 'monday'; // Show weekly tasks on Monday
    case 'specific_days':
      return item.specificDays.includes(dayName);
    default:
      return true;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get('weekStart');
    const section = searchParams.get('section');
    
    // Default to current Monday if no week specified
    const today = new Date();
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    
    const weekStart = weekStartParam ? new Date(weekStartParam) : currentMonday;
    const weekDates = getWeekDates(weekStart);
    
    // Get all active checklist templates
    let where = { isActive: true };
    if (section) {
      where = { ...where, section };
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get completions for this week
    const completions = await prisma.checklistCompletion.findMany({
      where: {
        date: {
          gte: weekDates[0],
          lte: weekDates[6],
        },
      },
      include: {
        item: true,
      },
    });

    // Build weekly view
    const weeklyData = weekDates.map((date, dayIndex) => {
      const dayName = getDayName(date);
      const dayCompletions = completions.filter(c => 
        c.date.toDateString() === date.toDateString()
      );
      
      const sections = templates.map(template => ({
        id: template.id,
        name: template.name,
        section: template.section,
        items: template.items
          .filter(item => shouldShowItemForDay(item, dayName))
          .map(item => {
            const completion = dayCompletions.find(c => c.itemId === item.id);
            return {
              id: item.id,
              title: item.title,
              description: item.description,
              frequency: item.frequency,
              completed: !!completion,
              completedBy: completion?.completedBy,
              completedAt: completion?.completedAt,
              notes: completion?.notes,
            };
          }),
      })).filter(section => section.items.length > 0);

      return {
        date: date.toISOString().split('T')[0],
        dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        sections,
      };
    });

    return createSuccessResponse({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekDates[6].toISOString().split('T')[0],
      days: weeklyData,
    });
  } catch (error: any) {
    console.error('Error fetching weekly checklist:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';