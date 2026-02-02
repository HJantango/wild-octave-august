import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VendorScheduleData {
  vendorName: string;
  orderDay: string;
  deliveryDay?: string;
  frequency: string;
  orderDeadline?: string;
  orderType: string;
  contactMethod?: string;
  trigger?: string;
  notes?: string;
  assignees?: string[];
}

const vendorSchedules: VendorScheduleData[] = [
  // From Cafe Schedule - Weekly
  {
    vendorName: 'Byron Bay Gourmet Pies',
    orderDay: 'Monday',
    deliveryDay: 'Monday',
    frequency: 'weekly',
    orderType: 'regular',
    contactMethod: 'Call/Order',
    notes: 'Pies delivery - twice weekly (Mon & Wed)',
  },
  {
    vendorName: 'Byron Bay Gourmet Pies',
    orderDay: 'Wednesday',
    deliveryDay: 'Wednesday',
    frequency: 'weekly',
    orderType: 'regular',
    contactMethod: 'Call/Order',
    notes: 'Pies delivery - twice weekly (Mon & Wed)',
  },
  {
    vendorName: 'Liz Jackson',
    orderDay: 'Tuesday',
    deliveryDay: 'Tuesday',
    frequency: 'weekly',
    orderType: 'regular',
    contactMethod: 'Call/Order',
    notes: 'Gluten free cakes',
  },
  {
    vendorName: 'Yummify (Arianne)',
    orderDay: 'Sunday',
    deliveryDay: 'Sunday',
    frequency: 'weekly',
    orderType: 'regular',
    contactMethod: 'Call/Order',
    notes: 'Savoury and sweet items',
  },
  
  // From Cafe Schedule - Fortnightly
  {
    vendorName: 'Byron Bay Brownies',
    orderDay: 'Friday',
    deliveryDay: 'Friday',
    frequency: 'fortnightly',
    orderType: 'regular',
    contactMethod: 'She calls',
    notes: 'Brownies - fortnightly',
  },
  {
    vendorName: 'Gigis',
    orderDay: 'Sunday',
    deliveryDay: 'Sunday',
    frequency: 'fortnightly',
    orderType: 'regular',
    contactMethod: 'Email',
    notes: 'Vegan sweets - fortnightly',
  },
  {
    vendorName: 'Zenfelds',
    orderDay: 'Sunday',
    deliveryDay: 'Sunday',
    frequency: 'fortnightly',
    orderType: 'regular',
    contactMethod: 'Call/Order',
    notes: 'Coffee - fortnightly',
  },
  
  // From Cafe Schedule - Incidentals
  {
    vendorName: 'Marlena',
    orderDay: 'Monday', // placeholder
    frequency: 'when-needed',
    orderType: 'when-needed',
    contactMethod: 'Text',
    trigger: 'When needed',
    notes: 'Samosas',
  },
  {
    vendorName: 'Blue Bay Gourmet',
    orderDay: 'Monday', // placeholder
    frequency: 'when-needed',
    orderType: 'when-needed',
    contactMethod: 'Order',
    trigger: 'When needed',
    notes: 'Frozen Mango / Berries - next day delivery',
  },
  {
    vendorName: 'All Good Foods',
    orderDay: 'Monday', // placeholder
    frequency: 'when-needed',
    orderType: 'when-needed',
    contactMethod: 'Notify Jackie',
    trigger: 'When needed',
    notes: 'Acaii',
  },
  {
    vendorName: 'David Dahl',
    orderDay: 'Monday', // placeholder
    frequency: 'when-needed',
    orderType: 'when-needed',
    contactMethod: 'Call, then text',
    trigger: 'When down to last bucket',
    notes: 'Product',
  },
  
  // New vendors requested by Heath
  {
    vendorName: 'Beach & Bush',
    orderDay: 'Monday',
    frequency: 'weekly',
    orderDeadline: '3:00 PM',
    orderType: 'regular',
    notes: 'Weekly order deadline Monday 3pm',
  },
  {
    vendorName: 'Byron Coop',
    orderDay: 'Thursday',
    frequency: 'weekly',
    orderDeadline: '12:00 PM',
    orderType: 'regular',
    notes: 'Weekly order deadline Thursday noon',
  },
];

async function main() {
  console.log('Seeding cafe vendor schedules...\n');

  for (const schedule of vendorSchedules) {
    // Find or create vendor
    let vendor = await prisma.vendor.findUnique({
      where: { name: schedule.vendorName },
    });

    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: { name: schedule.vendorName },
      });
      console.log(`✓ Created vendor: ${vendor.name}`);
    } else {
      console.log(`  Found existing vendor: ${vendor.name}`);
    }

    // Check if schedule already exists
    const existing = await prisma.vendorOrderSchedule.findFirst({
      where: {
        vendorId: vendor.id,
        orderDay: schedule.orderDay,
      },
    });

    if (existing) {
      console.log(`  Schedule already exists for ${vendor.name} on ${schedule.orderDay}, skipping`);
      continue;
    }

    // Create schedule
    await prisma.vendorOrderSchedule.create({
      data: {
        vendorId: vendor.id,
        orderDay: schedule.orderDay,
        deliveryDay: schedule.deliveryDay || null,
        frequency: schedule.frequency,
        orderDeadline: schedule.orderDeadline || null,
        orderType: schedule.orderType,
        contactMethod: schedule.contactMethod || null,
        trigger: schedule.trigger || null,
        notes: schedule.notes || null,
        assignees: schedule.assignees || [],
        isActive: true,
      },
    });
    console.log(`  ✓ Created schedule: ${vendor.name} - ${schedule.orderDay} (${schedule.frequency})`);
  }

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
