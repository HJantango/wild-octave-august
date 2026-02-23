import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CORRECT rates from Heath's CSV file
const correctRates = [
  {
    name: 'Heath Jansse',
    base: 35.0,
    saturday: 52.50,
    sunday: 52.50,
    publicHoliday: null
  },
  {
    name: 'Jacqueline Willis',
    base: 28.0,
    saturday: 42.00,
    sunday: 49.00,
    publicHoliday: 70.00
  },
  {
    name: 'Jacqueline  Willis', // Handle double space variation
    base: 28.0,
    saturday: 42.00,
    sunday: 49.00,
    publicHoliday: 70.00
  },
  {
    name: 'Jasper Willis',
    base: 20.0,
    saturday: 30.00,
    sunday: 35.00,
    publicHoliday: 50.00
  },
  {
    name: 'Charlotte George',
    base: 32.0,
    saturday: 48.00,
    sunday: 48.00,
    publicHoliday: null
  },
  {
    name: 'Chilli Mamet',
    base: 21.2,
    saturday: 31.86,
    sunday: 37.17,
    publicHoliday: 53.10
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apply = searchParams.get('apply') === 'true';
  
  try {
    const results = [];
    
    for (const rates of correctRates) {
      // Find the staff member
      const staff = await prisma.rosterStaff.findFirst({
        where: {
          OR: [
            { name: rates.name },
            { name: rates.name.replace('  ', ' ') },
            { name: rates.name.replace(' ', '  ') }
          ],
          isActive: true
        }
      });

      if (!staff) {
        results.push({
          name: rates.name,
          status: 'not_found',
          message: `Staff member not found: ${rates.name}`
        });
        continue;
      }

      const changes = [];
      if (staff.baseHourlyRate != rates.base) changes.push('base');
      if ((staff.saturdayHourlyRate || null) != rates.saturday) changes.push('saturday');
      if ((staff.sundayHourlyRate || null) != rates.sunday) changes.push('sunday');
      if ((staff.publicHolidayHourlyRate || null) != rates.publicHoliday) changes.push('publicHoliday');

      const result = {
        name: staff.name,
        found: true,
        current: {
          base: Number(staff.baseHourlyRate),
          saturday: staff.saturdayHourlyRate ? Number(staff.saturdayHourlyRate) : null,
          sunday: staff.sundayHourlyRate ? Number(staff.sundayHourlyRate) : null,
          publicHoliday: staff.publicHolidayHourlyRate ? Number(staff.publicHolidayHourlyRate) : null
        },
        correct: {
          base: rates.base,
          saturday: rates.saturday,
          sunday: rates.sunday,
          publicHoliday: rates.publicHoliday
        },
        needsChanges: changes,
        status: changes.length > 0 ? 'needs_update' : 'up_to_date'
      };

      if (apply && changes.length > 0) {
        await prisma.rosterStaff.update({
          where: { id: staff.id },
          data: {
            baseHourlyRate: rates.base,
            saturdayHourlyRate: rates.saturday,
            sundayHourlyRate: rates.sunday,
            publicHolidayHourlyRate: rates.publicHoliday
          }
        });
        result.status = 'updated';
      }

      results.push(result);
    }
    
    return NextResponse.json({
      success: true,
      dryRun: !apply,
      results,
      summary: {
        total: results.length,
        needsUpdate: results.filter(r => r.status === 'needs_update').length,
        updated: results.filter(r => r.status === 'updated').length,
        upToDate: results.filter(r => r.status === 'up_to_date').length,
        notFound: results.filter(r => r.status === 'not_found').length
      }
    });
    
  } catch (error) {
    console.error('Error in fix-rates API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}