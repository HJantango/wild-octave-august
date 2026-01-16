const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVendors() {
  // Find all vendors
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' }
  });
  
  console.log('All vendors:');
  vendors.forEach(v => console.log(`- ${v.name} (ID: ${v.id})`));
  
  // Check for BankVic-like names
  const bankvic = vendors.filter(v => v.name.toLowerCase().includes('bank'));
  
  if (bankvic.length > 0) {
    console.log('\n\nVendors with "bank" in name:');
    console.log(JSON.stringify(bankvic, null, 2));
    
    // Get scheduled orders for these vendors
    for (const vendor of bankvic) {
      const orders = await prisma.scheduledOrder.findMany({
        where: { vendorId: vendor.id },
        orderBy: { scheduleDate: 'desc' },
        take: 10
      });
      
      console.log(`\n\nScheduled orders for ${vendor.name}:`);
      console.log(JSON.stringify(orders, null, 2));
    }
  }
  
  await prisma.$disconnect();
}

checkVendors().catch(console.error);
