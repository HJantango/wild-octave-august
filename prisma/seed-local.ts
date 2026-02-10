import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding local development database...');

  // Create test staff
  const staffData = [
    { name: 'Test Manager', role: 'Manager', baseHourlyRate: 35.00, saturdayHourlyRate: 52.50, sundayHourlyRate: 70.00, taxRate: 30, superRate: 11.5, email: 'manager@test.local', isActive: true },
    { name: 'Test Barista', role: 'Barista', baseHourlyRate: 28.00, saturdayHourlyRate: 42.00, sundayHourlyRate: 56.00, taxRate: 25, superRate: 11.5, email: 'barista@test.local', isActive: true },
    { name: 'Test Kitchen', role: 'Kitchen', baseHourlyRate: 26.00, saturdayHourlyRate: 39.00, sundayHourlyRate: 52.00, taxRate: 20, superRate: 11.5, email: 'kitchen@test.local', isActive: true },
    { name: 'Test Junior', role: 'Junior', baseHourlyRate: 18.00, saturdayHourlyRate: 27.00, sundayHourlyRate: 36.00, taxRate: 0, superRate: null, email: 'junior@test.local', isActive: true },
  ];

  for (const staff of staffData) {
    await prisma.rosterStaff.upsert({
      where: { name: staff.name },
      update: staff,
      create: staff,
    });
    console.log(`  ✅ Staff: ${staff.name}`);
  }

  // Create a test roster for this week
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // Get Monday of current week
  monday.setHours(0, 0, 0, 0);

  const roster = await prisma.roster.upsert({
    where: { weekStartDate: monday },
    update: { status: 'draft' },
    create: {
      weekStartDate: monday,
      status: 'draft',
    },
  });
  console.log(`  ✅ Roster: Week of ${monday.toISOString().split('T')[0]}`);

  // Get staff IDs
  const allStaff = await prisma.rosterStaff.findMany();
  const manager = allStaff.find(s => s.role === 'Manager');
  const barista = allStaff.find(s => s.role === 'Barista');

  // Create some test shifts
  if (manager && barista) {
    // Delete existing shifts for this roster
    await prisma.rosterShift.deleteMany({ where: { rosterId: roster.id } });

    const shifts = [
      // Monday
      { rosterId: roster.id, staffId: manager.id, dayOfWeek: 1, startTime: '07:30', endTime: '15:30', breakMinutes: 30, role: 'Manager' },
      { rosterId: roster.id, staffId: barista.id, dayOfWeek: 1, startTime: '08:00', endTime: '16:00', breakMinutes: 30, role: 'Barista' },
      // Tuesday
      { rosterId: roster.id, staffId: manager.id, dayOfWeek: 2, startTime: '07:30', endTime: '15:30', breakMinutes: 30, role: 'Manager' },
      { rosterId: roster.id, staffId: barista.id, dayOfWeek: 2, startTime: '08:00', endTime: '16:00', breakMinutes: 30, role: 'Barista' },
      // Wednesday
      { rosterId: roster.id, staffId: manager.id, dayOfWeek: 3, startTime: '10:00', endTime: '18:00', breakMinutes: 30, role: 'Manager' },
    ];

    for (const shift of shifts) {
      await prisma.rosterShift.create({ data: shift });
    }
    console.log(`  ✅ Created ${shifts.length} test shifts`);
  }

  // Create a test user
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  
  await prisma.user.upsert({
    where: { email: 'test@test.local' },
    update: {},
    create: {
      email: 'test@test.local',
      password: hashedPassword,
      name: 'Test User',
      role: 'ADMIN',
    },
  });
  console.log('  ✅ Test user: test@test.local / testpassword123');

  console.log('\n🎉 Local database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
