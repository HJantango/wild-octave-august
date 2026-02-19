import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET - Fetch public holidays within a date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const state = searchParams.get('state') || 'NSW';

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end date parameters are required' },
        { status: 400 }
      );
    }

    const holidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(start),
          lte: new Date(end),
        },
        state: state,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(holidays);
  } catch (error) {
    console.error('Error fetching public holidays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public holidays' },
      { status: 500 }
    );
  }
}

// POST - Add a public holiday
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, date, state = 'NSW' } = body;

    if (!name || !date) {
      return NextResponse.json(
        { error: 'name and date are required' },
        { status: 400 }
      );
    }

    const holiday = await prisma.publicHoliday.create({
      data: {
        name,
        date: new Date(date),
        state,
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A public holiday already exists for this date and state' },
        { status: 409 }
      );
    }
    console.error('Error creating public holiday:', error);
    return NextResponse.json(
      { error: 'Failed to create public holiday' },
      { status: 500 }
    );
  }
}
