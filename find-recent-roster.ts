#!/usr/bin/env npx tsx
/**
 * Find recent rosters to debug SMS sending
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const prisma = new PrismaClient();

async function findRecentRosters() {
  try {
    console.log('🗓️  Finding recent rosters...\n');

    // Get the last 5 rosters with their shift counts
    const rosters = await prisma.roster.findMany({
      take: 5,
      orderBy: {
        weekStartDate: 'desc',
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            shifts: true,
          },
        },
      },
    });

    if (rosters.length === 0) {
      console.log('❌ No rosters found');
      return;
    }

    console.log(`📋 Found ${rosters.length} recent rosters:\n`);

    rosters.forEach((roster, index) => {
      const weekStart = new Date(roster.weekStartDate);
      const formattedDate = weekStart.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });

      console.log(`${index + 1}. Roster ID: ${roster.id}`);
      console.log(`   Week: ${formattedDate}`);
      console.log(`   Shifts: ${roster._count.shifts}`);
      
      // Show unique staff in this roster
      const uniqueStaff = roster.shifts
        .map(shift => shift.staff)
        .filter((staff, index, self) =>
          index === self.findIndex(s => s.name === staff.name)
        );
      
      console.log(`   Staff (${uniqueStaff.length}):`, uniqueStaff.map(s => s.name).join(', '));
      
      const staffWithPhones = uniqueStaff.filter(s => s.phone);
      console.log(`   With phones: ${staffWithPhones.length}/${uniqueStaff.length}`);
      console.log('');
    });

    // Show debug URL for most recent roster
    if (rosters.length > 0) {
      const mostRecent = rosters[0];
      const debugUrl = `https://wild-octave-august-production-a54e.up.railway.app/api/debug/sms-recipients/${mostRecent.id}`;
      console.log(`🔍 Debug SMS recipients for most recent roster:`);
      console.log(`   curl "${debugUrl}"`);
    }

  } catch (error) {
    console.error('❌ Error finding rosters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findRecentRosters();