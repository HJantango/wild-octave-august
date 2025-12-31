import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');

  // Default category markups
  const defaultMarkups = [
    { key: 'markup_house', value: 1.65, description: 'Markup for House category' },
    { key: 'markup_bulk', value: 1.75, description: 'Markup for Bulk category' },
    { key: 'markup_fruit_veg', value: 1.75, description: 'Markup for Fruit & Veg category' },
    { key: 'markup_fridge_freezer', value: 1.5, description: 'Markup for Fridge & Freezer category' },
    { key: 'markup_naturo', value: 1.65, description: 'Markup for Naturo category' },
    { key: 'markup_groceries', value: 1.65, description: 'Markup for Groceries category' },
    { key: 'markup_drinks_fridge', value: 1.65, description: 'Markup for Drinks Fridge category' },
    { key: 'markup_supplements', value: 1.65, description: 'Markup for Supplements category' },
    { key: 'markup_personal_care', value: 1.65, description: 'Markup for Personal Care category' },
    { key: 'markup_fresh_bread', value: 1.5, description: 'Markup for Fresh Bread category' },
  ];

  // Create default settings
  console.log('📊 Creating default category markups...');
  for (const markup of defaultMarkups) {
    await prisma.settings.upsert({
      where: { key: markup.key },
      update: {},
      create: {
        key: markup.key,
        value: markup.value,
        description: markup.description,
      },
    });
  }

  // GST rate setting
  await prisma.settings.upsert({
    where: { key: 'gst_rate' },
    update: {},
    create: {
      key: 'gst_rate',
      value: 0.10,
      description: 'GST rate for calculations',
    },
  });

  // OCR provider setting
  await prisma.settings.upsert({
    where: { key: 'ocr_provider' },
    update: {},
    create: {
      key: 'ocr_provider',
      value: 'tesseract',
      description: 'Default OCR provider (tesseract or azure)',
    },
  });

  // Pack size detection patterns
  const packSizePatterns = [
    '/12', 'doz', 'dozen', 'pack of 12', 'x12', '12pk',
    '/6', 'pack of 6', 'x6', '6pk',
    '/24', 'pack of 24', 'x24', '24pk',
    '/250g', '/500g', '/1kg', '/2kg',
  ];

  await prisma.settings.upsert({
    where: { key: 'pack_size_patterns' },
    update: {},
    create: {
      key: 'pack_size_patterns',
      value: packSizePatterns,
      description: 'Patterns for detecting pack sizes in invoice items',
    },
  });

  // Create sample vendor for testing
  console.log('🏪 Creating sample vendor...');
  const sampleVendor = await prisma.vendor.upsert({
    where: { name: 'Sample Organic Supplies' },
    update: {},
    create: {
      name: 'Sample Organic Supplies',
      contactInfo: {
        email: 'orders@sampleorganic.com',
        phone: '+61 3 9000 0000',
        address: '123 Organic Street, Melbourne VIC 3000',
      },
      paymentTerms: '30 days net',
    },
  });

  // Create sample items
  console.log('📦 Creating sample items...');
  const sampleItems = [
    {
      name: 'Organic Quinoa 500g',
      category: 'Groceries',
      costExGst: 8.50,
      markup: 1.65,
    },
    {
      name: 'Almond Milk 1L',
      category: 'Fridge & Freezer',
      costExGst: 3.20,
      markup: 1.5,
    },
    {
      name: 'Organic Bananas',
      category: 'Fruit & Veg',
      costExGst: 4.50,
      markup: 1.75,
    },
    {
      name: 'Vitamin D3 Supplement',
      category: 'Supplements',
      costExGst: 25.00,
      markup: 1.65,
    },
  ];

  const itemsToCreate = sampleItems.map((item, index) => {
    const sellExGst = Math.round(item.costExGst * item.markup * 100) / 100;
    const gstAmount = Math.round(sellExGst * 0.10 * 100) / 100;
    const sellIncGst = sellExGst + gstAmount;

    return {
      name: item.name,
      vendorId: sampleVendor.id,
      category: item.category,
      currentCostExGst: item.costExGst,
      currentMarkup: item.markup,
      currentSellExGst: sellExGst,
      currentSellIncGst: sellIncGst,
      sku: `SAMPLE-${index + 1}`,
    };
  });

  await prisma.item.createMany({
    data: itemsToCreate,
    skipDuplicates: true,
  });

  // Create roster staff
  console.log('👥 Creating roster staff...');
  const staffMembers = [
    { name: 'Heath', role: 'Manager', baseHourlyRate: 28.50 },
    { name: 'Jess', role: 'Manager', baseHourlyRate: 26.00 },
    { name: 'Emma', role: 'Barista', baseHourlyRate: 24.50 },
    { name: 'Clair', role: 'Barista', baseHourlyRate: 23.00 },
    { name: 'Paige', role: 'Barista', baseHourlyRate: 23.00 },
    { name: 'Nico', role: 'Barista', baseHourlyRate: 23.50 },
    { name: 'Mickel', role: 'Kitchen Staff', baseHourlyRate: 22.50 },
    { name: 'Charlotte', role: 'Barista', baseHourlyRate: 23.00 },
    { name: 'Chilli', role: 'Barista', baseHourlyRate: 23.00 },
    { name: 'Lux', role: 'Junior', baseHourlyRate: 18.50 },
    { name: 'Luna', role: 'Junior', baseHourlyRate: 18.50 },
    { name: 'Tiger', role: 'Junior', baseHourlyRate: 18.50 },
  ];

  for (const member of staffMembers) {
    await prisma.rosterStaff.upsert({
      where: { name: member.name },
      update: {},
      create: {
        name: member.name,
        role: member.role,
        baseHourlyRate: member.baseHourlyRate,
        isActive: true,
      },
    });
  }

  // Create roster settings
  console.log('⚙️ Creating roster settings...');
  await prisma.settings.upsert({
    where: { key: 'weekly_sales_target' },
    update: {},
    create: {
      key: 'weekly_sales_target',
      value: 25000,
      description: 'Weekly sales target for wage percentage calculations',
    },
  });

  await prisma.settings.upsert({
    where: { key: 'target_wage_percentage' },
    update: {},
    create: {
      key: 'target_wage_percentage',
      value: 30,
      description: 'Target wage percentage of weekly sales',
    },
  });

  // Note: Sales data should be uploaded via the sales upload page, not seeded
  console.log('📝 Skipping sales data creation - use sales upload page for real data');

  console.log('✅ Seed process completed!');
  console.log(`📊 Created ${defaultMarkups.length} default category markups`);
  console.log(`🏪 Created 1 sample vendor`);
  console.log(`📦 Created ${sampleItems.length} sample items`);
  console.log(`👥 Created ${staffMembers.length} roster staff members`);
  console.log(`📝 Note: Upload your real sales data via the sales upload page`);
}

main()
  .catch((e) => {
    console.error('❌ Seed process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });