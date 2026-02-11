import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Create the product_decisions table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS product_decisions (
        id TEXT PRIMARY KEY,
        item_id TEXT UNIQUE NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        decision TEXT NOT NULL DEFAULT 'undecided',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index on item_id
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_product_decisions_item_id ON product_decisions(item_id)
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'ProductDecision table created successfully' 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
