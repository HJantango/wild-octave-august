import { NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

// POST /api/cash-up/migrate - Create cash_ups table
export async function POST() {
  try {
    // Create the cash_ups table using raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS cash_ups (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        register TEXT NOT NULL,
        notes_100 INTEGER DEFAULT 0,
        notes_50 INTEGER DEFAULT 0,
        notes_20 INTEGER DEFAULT 0,
        notes_10 INTEGER DEFAULT 0,
        notes_5 INTEGER DEFAULT 0,
        coins_200 INTEGER DEFAULT 0,
        coins_100 INTEGER DEFAULT 0,
        coins_50 INTEGER DEFAULT 0,
        coins_20 INTEGER DEFAULT 0,
        coins_10 INTEGER DEFAULT 0,
        coins_5 INTEGER DEFAULT 0,
        total_cash DECIMAL(10,2) NOT NULL,
        float_amount DECIMAL(10,2) DEFAULT 200,
        cash_sales DECIMAL(10,2) NOT NULL,
        square_cash_sales DECIMAL(10,2),
        variance DECIMAL(10,2),
        completed_by TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, register)
      )
    `;

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_cash_ups_date ON cash_ups(date)
    `;

    return NextResponse.json({
      success: true,
      message: 'Cash-up table created successfully',
    });
  } catch (error) {
    console.error('Error creating cash-up table:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create cash-up table', details: String(error) } },
      { status: 500 }
    );
  }
}
