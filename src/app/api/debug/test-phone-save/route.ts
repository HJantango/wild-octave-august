import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone } = body;

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Name required'
      }, { status: 400 });
    }

    console.log('=== DEBUG PHONE SAVE ===');
    console.log('Input name:', name);
    console.log('Input phone:', phone);
    console.log('Input phone type:', typeof phone);
    console.log('Phone length:', phone?.length);

    // Create minimal staff record to test phone persistence
    const staff = await prisma.rosterStaff.create({
      data: {
        name: name + '_test_' + Date.now(), // Make unique
        role: 'Test',
        baseHourlyRate: 25.0,
        phone: phone || null, // Explicit null if empty
      }
    });

    console.log('Created staff ID:', staff.id);
    console.log('Saved phone value:', staff.phone);
    console.log('Saved phone type:', typeof staff.phone);

    // Fetch it back immediately to verify persistence  
    const fetched = await prisma.rosterStaff.findUnique({
      where: { id: staff.id },
      select: { id: true, name: true, phone: true }
    });

    console.log('Fetched back phone:', fetched?.phone);
    console.log('Fetched back phone type:', typeof fetched?.phone);

    const phoneMatch = phone === fetched?.phone;
    console.log('Phone values match:', phoneMatch);

    return NextResponse.json({
      success: true,
      debug: {
        inputPhone: phone,
        inputPhoneType: typeof phone,
        savedPhone: staff.phone,
        savedPhoneType: typeof staff.phone,
        fetchedPhone: fetched?.phone,
        fetchedPhoneType: typeof fetched?.phone,
        phoneMatch,
        staffId: staff.id,
        databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Missing'
      },
      test: phoneMatch ? 'PASS' : 'FAIL'
    });

  } catch (error) {
    console.error('Phone save test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}