const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CORRECT rates from your CSV file
const correctRates = [
  {
    name: 'Heath Jansse',
    base: 35.0,
    saturday: 52.50,
    sunday: 52.50,
    publicHoliday: null // CSV shows blank - probably uses base rate + some other calculation
  },
  {
    name: 'Jacqueline Willis', // Note: CSV has extra space - might need to match "Jacqueline  Willis"
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
    publicHoliday: null // CSV shows blank
  },
  {
    name: 'Chilli Mamet',
    base: 21.2,
    saturday: 31.86,
    sunday: 37.17,
    publicHoliday: 53.10
  }
  // Add more staff as needed...
];

async function updatePenaltyRates(dryRun = true) {
  try {
    console.log(`\n🔧 ${dryRun ? 'DRY RUN - NO CHANGES MADE' : 'UPDATING PENALTY RATES'}\n`);
    console.log('═'.repeat(80));
    
    for (const rates of correctRates) {
      console.log(`\n👤 ${rates.name.toUpperCase()}`);
      console.log('─'.repeat(40));
      
      // Find the staff member (handle potential name variations)
      const staff = await prisma.rosterStaff.findFirst({
        where: {
          OR: [
            { name: rates.name },
            { name: rates.name.replace('  ', ' ') }, // Handle double spaces
            { name: rates.name.replace(' ', '  ') }  // Handle missing double spaces
          ],
          isActive: true
        }
      });

      if (!staff) {
        console.log(`❌ Staff member not found: ${rates.name}`);
        continue;
      }

      console.log(`✅ Found: ${staff.name}`);
      
      // Show current vs correct rates
      console.log(`   Base Rate:     $${staff.baseHourlyRate} → $${rates.base} ${staff.baseHourlyRate != rates.base ? '(UPDATE)' : '(OK)'}`);
      console.log(`   Saturday:      $${staff.saturdayHourlyRate || 'NULL'} → $${rates.saturday || 'NULL'} ${(staff.saturdayHourlyRate || null) != rates.saturday ? '(UPDATE)' : '(OK)'}`);
      console.log(`   Sunday:        $${staff.sundayHourlyRate || 'NULL'} → $${rates.sunday || 'NULL'} ${(staff.sundayHourlyRate || null) != rates.sunday ? '(UPDATE)' : '(OK)'}`);
      console.log(`   Public Hol:    $${staff.publicHolidayHourlyRate || 'NULL'} → $${rates.publicHoliday || 'NULL'} ${(staff.publicHolidayHourlyRate || null) != rates.publicHoliday ? '(UPDATE)' : '(OK)'}`);
      
      if (!dryRun) {
        // Actually update the database
        await prisma.rosterStaff.update({
          where: { id: staff.id },
          data: {
            baseHourlyRate: rates.base,
            saturdayHourlyRate: rates.saturday,
            sundayHourlyRate: rates.sunday,
            publicHolidayHourlyRate: rates.publicHoliday
          }
        });
        console.log(`   ✅ UPDATED successfully`);
      }
    }
    
    if (dryRun) {
      console.log('\n🦝 DRY RUN COMPLETE - No changes made to database');
      console.log('   Run with: node fix-penalty-rates.js --apply   to actually apply changes');
    } else {
      console.log('\n✅ ALL PENALTY RATES UPDATED SUCCESSFULLY!');
      console.log('   Your roster calculations should now match the CSV rates.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if --apply flag is provided
const shouldApply = process.argv.includes('--apply');
updatePenaltyRates(!shouldApply);