import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get distinct vendor names from sales data
  const vendors = await prisma.squareDailySales.findMany({
    select: { vendorName: true },
    distinct: ['vendorName'],
    where: { vendorName: { not: null } },
  });
  console.log('Vendors in sales data:');
  vendors.forEach(v => console.log(`  - "${v.vendorName}"`));
  
  // Check for Byron/pie related items
  const pieItems = await prisma.squareDailySales.findMany({
    select: { vendorName: true, itemName: true, variationName: true },
    distinct: ['itemName'],
    where: {
      OR: [
        { vendorName: { contains: 'byron', mode: 'insensitive' } },
        { vendorName: { contains: 'gourmet', mode: 'insensitive' } },
        { vendorName: { contains: 'pie', mode: 'insensitive' } },
        { itemName: { contains: 'samosa', mode: 'insensitive' } },
      ]
    },
    take: 30,
  });
  console.log('\nPie/samosa items found:');
  pieItems.forEach(v => console.log(`  vendor: "${v.vendorName}" | item: "${v.itemName}" | var: "${v.variationName}"`));
  
  // Also check the Vendor table
  const dbVendors = await prisma.vendor.findMany({
    select: { name: true },
  });
  console.log('\nAll vendors in Vendor table:');
  dbVendors.forEach(v => console.log(`  - "${v.name}"`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
