import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all items with subcategory = 'Shelf'
  const shelfItems = await prisma.item.findMany({
    where: {
      subcategory: 'Shelf',
    },
    select: {
      id: true,
      name: true,
      category: true,
      subcategory: true,
      vendor: {
        select: {
          name: true,
        },
      },
    },
    take: 50,
  });

  console.log(`Found ${shelfItems.length} items with subcategory='Shelf':\n`);

  shelfItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name}`);
    console.log(`   Category: ${item.category}`);
    console.log(`   Vendor: ${item.vendor?.name || 'N/A'}`);
    console.log('');
  });

  // Get count by category
  const categoryCounts = await prisma.item.groupBy({
    by: ['category'],
    where: {
      subcategory: 'Shelf',
    },
    _count: {
      category: true,
    },
  });

  console.log('\nCount by category:');
  categoryCounts.forEach(cat => {
    console.log(`  ${cat.category}: ${cat._count.category}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
