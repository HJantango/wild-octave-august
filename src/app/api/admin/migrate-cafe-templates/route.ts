import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// One-time migration endpoint to create cafe_label_templates table
export async function POST() {
  const prisma = new PrismaClient();
  
  try {
    // Check if table already exists
    const tableExists = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cafe_label_templates'
      ) as exists
    `;

    if (tableExists[0]?.exists) {
      await prisma.$disconnect();
      return NextResponse.json({ 
        success: true, 
        message: 'Table cafe_label_templates already exists' 
      });
    }

    // Create the table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS cafe_label_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL UNIQUE,
        organic BOOLEAN NOT NULL DEFAULT false,
        vegan BOOLEAN NOT NULL DEFAULT false,
        gluten_free BOOLEAN NOT NULL DEFAULT false,
        ingredients TEXT,
        price TEXT,
        bg_color TEXT NOT NULL DEFAULT '#E2E3F0',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index on name
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS cafe_label_templates_name_idx ON cafe_label_templates(name)
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Table cafe_label_templates created successfully' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'POST to this endpoint to run the cafe_label_templates migration' 
  });
}
