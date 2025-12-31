const { PrismaClient } = require('@prisma/client');

async function seedRosterData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🌱 Seeding roster data...');

    // Seed staff
    const staff = [
      { name: 'Jackie', role: 'manager', baseHourlyRate: 35.00 },
      { name: 'Alexandra', role: 'manager', baseHourlyRate: 32.00 },
      { name: 'Heath', role: 'manager', baseHourlyRate: 38.00 },
      { name: 'Jasper', role: 'manager', baseHourlyRate: 30.00 },
      { name: 'Tosh', role: 'barista', baseHourlyRate: 28.00 },
      { name: 'Katie', role: 'barista', baseHourlyRate: 26.00 },
      { name: 'Hanna', role: 'barista', baseHourlyRate: 25.00 }
    ];

    for (const person of staff) {
      await prisma.staff.upsert({
        where: { name: person.name },
        update: person,
        create: person
      });
      console.log(`✅ Added staff: ${person.name} (${person.role} - $${person.baseHourlyRate}/hr)`);
    }

    // Seed public holidays for 2025
    const holidays = [
      { name: "New Year's Day", date: new Date('2025-01-01'), state: 'NSW' },
      { name: "Australia Day", date: new Date('2025-01-27'), state: 'NSW' },
      { name: "Good Friday", date: new Date('2025-04-18'), state: 'NSW' },
      { name: "Easter Saturday", date: new Date('2025-04-19'), state: 'NSW' },
      { name: "Easter Monday", date: new Date('2025-04-21'), state: 'NSW' },
      { name: "Anzac Day", date: new Date('2025-04-25'), state: 'NSW' },
      { name: "King's Birthday", date: new Date('2025-06-09'), state: 'NSW' },
      { name: "Labour Day", date: new Date('2025-10-06'), state: 'NSW' },
      { name: "Christmas Day", date: new Date('2025-12-25'), state: 'NSW' },
      { name: "Boxing Day", date: new Date('2025-12-26'), state: 'NSW' }
    ];

    for (const holiday of holidays) {
      try {
        await prisma.publicHoliday.create({
          data: holiday
        });
        console.log(`✅ Added holiday: ${holiday.name} (${holiday.date.toDateString()})`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⏭️ Holiday already exists: ${holiday.name}`);
        } else {
          throw error;
        }
      }
    }

    console.log('🎉 Roster data seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRosterData();