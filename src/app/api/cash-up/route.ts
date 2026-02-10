import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// GET /api/cash-up - Get cash-up records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const register = searchParams.get('register');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: Record<string, unknown> = {};

    if (date) {
      whereClause.date = new Date(date);
    } else if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (register) {
      whereClause.register = register;
    }

    const cashUps = await prisma.cashUp.findMany({
      where: whereClause,
      orderBy: [
        { date: 'desc' },
        { register: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: cashUps,
    });
  } catch (error) {
    console.error('Error fetching cash-ups:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch cash-up records' } },
      { status: 500 }
    );
  }
}

// POST /api/cash-up - Save cash-up record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date,
      register,
      notes100 = 0,
      notes50 = 0,
      notes20 = 0,
      notes10 = 0,
      notes5 = 0,
      coins200 = 0,
      coins100 = 0,
      coins50 = 0,
      coins20 = 0,
      coins10 = 0,
      coins5 = 0,
      squareCashSales,
      completedBy,
      notes,
    } = body;

    if (!date || !register) {
      return NextResponse.json(
        { success: false, error: { message: 'Date and register are required' } },
        { status: 400 }
      );
    }

    // Calculate totals
    const notesTotal = 
      notes100 * 100 + 
      notes50 * 50 + 
      notes20 * 20 + 
      notes10 * 10 + 
      notes5 * 5;

    const coinsTotal = 
      coins200 * 2 + 
      coins100 * 1 + 
      coins50 * 0.5 + 
      coins20 * 0.2 + 
      coins10 * 0.1 + 
      coins5 * 0.05;

    const totalCash = notesTotal + coinsTotal;
    const floatAmount = 200;
    const cashSales = totalCash - floatAmount;
    const variance = squareCashSales != null ? cashSales - squareCashSales : null;

    // Upsert - update if exists, create if not
    const cashUp = await prisma.cashUp.upsert({
      where: {
        date_register: {
          date: new Date(date),
          register,
        },
      },
      update: {
        notes100,
        notes50,
        notes20,
        notes10,
        notes5,
        coins200,
        coins100,
        coins50,
        coins20,
        coins10,
        coins5,
        totalCash,
        floatAmount,
        cashSales,
        squareCashSales,
        variance,
        completedBy,
        notes,
      },
      create: {
        date: new Date(date),
        register,
        notes100,
        notes50,
        notes20,
        notes10,
        notes5,
        coins200,
        coins100,
        coins50,
        coins20,
        coins10,
        coins5,
        totalCash,
        floatAmount,
        cashSales,
        squareCashSales,
        variance,
        completedBy,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: cashUp,
      message: 'Cash-up saved successfully',
    });
  } catch (error) {
    console.error('Error saving cash-up:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to save cash-up' } },
      { status: 500 }
    );
  }
}
