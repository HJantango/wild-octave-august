const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixVendorAssignments() {
  try {
    console.log('🔧 Starting vendor assignment fix...');

    // Get recent sales data to find items missing vendor assignments
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get sales data with vendor info  
    const salesWithVendors = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: thirtyDaysAgo },
        vendorName: { not: null },
      },
      select: {
        itemName: true,
        vendorName: true,
        squareCatalogId: true,
      },
      distinct: ['itemName', 'vendorName'],
    });

    console.log(`📦 Found ${salesWithVendors.length} sales records with vendor data`);

    // Group by vendor name
    const vendorGroups = new Map();
    for (const sale of salesWithVendors) {
      if (!sale.vendorName) continue;
      
      if (!vendorGroups.has(sale.vendorName)) {
        vendorGroups.set(sale.vendorName, []);
      }
      vendorGroups.get(sale.vendorName).push({
        itemName: sale.itemName,
        squareCatalogId: sale.squareCatalogId,
      });
    }

    console.log(`📦 Found ${vendorGroups.size} unique vendors in sales data`);

    let fixedCount = 0;
    let vendorsCreated = 0;

    for (const [vendorName, items] of vendorGroups) {
      // Find or create vendor
      let vendor = await prisma.vendor.findFirst({
        where: { name: { equals: vendorName, mode: 'insensitive' } }
      });

      if (!vendor) {
        vendor = await prisma.vendor.create({
          data: { name: vendorName }
        });
        vendorsCreated++;
        console.log(`✅ Created vendor: ${vendorName}`);
      }

      // Assign vendor to items
      for (const itemInfo of items) {
        // Find item by Square ID first, then by name
        let item = null;
        if (itemInfo.squareCatalogId) {
          item = await prisma.item.findFirst({
            where: { squareCatalogId: itemInfo.squareCatalogId }
          });
        }
        if (!item) {
          item = await prisma.item.findFirst({
            where: { name: { equals: itemInfo.itemName, mode: 'insensitive' } }
          });
        }

        if (item && !item.vendorId) {
          await prisma.item.update({
            where: { id: item.id },
            data: { vendorId: vendor.id }
          });
          fixedCount++;
          console.log(`✅ Assigned ${vendorName} → "${itemInfo.itemName}"`);
        }
      }
    }

    console.log(`🎉 COMPLETED:`);
    console.log(`   - Created ${vendorsCreated} new vendors`);
    console.log(`   - Fixed ${fixedCount} item assignments`);
    console.log(`   - Processed ${vendorGroups.size} vendors total`);
    
    // Check if Heaps Good was created
    const heapsGood = await prisma.vendor.findFirst({
      where: { name: { contains: 'Heaps Good', mode: 'insensitive' } }
    });
    if (heapsGood) {
      console.log(`✨ Heaps Good vendor found: ${heapsGood.name} (ID: ${heapsGood.id})`);
    }

    return {
      vendorsCreated,
      itemsFixed: fixedCount,
      vendorsProcessed: vendorGroups.size,
    };
  } catch (error) {
    console.error('❌ Error fixing vendor assignments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixVendorAssignments()
  .then(result => {
    console.log('📊 Final result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });