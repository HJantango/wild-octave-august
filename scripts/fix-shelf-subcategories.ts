import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Same mappings from square-vendor route (ordered by specificity - most specific first)
const SUBCATEGORY_MAPPINGS: Record<string, string> = {
  // Multi-word patterns first (most specific)
  'ice cream': 'Ice Cream Freezer',
  'fridge & freezer': 'Food Fridge',
  'fresh bread': 'Fresh Bread',
  'bone broth': 'Tins',
  'cashew cheese': 'Fridge',
  'virgin olive oil': 'Cooking Oils',
  'olive oil': 'Cooking Oils',
  'pancake mix': 'Baking and Cooking',

  // Single-word patterns (more specific categories)
  'tempeh': 'Tofu Fridge',
  'tofu': 'Tofu Fridge',
  'tortilla': 'International Groceries',
  'wrap': 'International Groceries',
  'broth': 'Tins',
  'cola': 'Drinks Fridge',
  'coffee': 'Coffee Retail',
  'espresso': 'Coffee Retail',
  'chai': 'Chai and Tea and Coffee',
  'tea': 'Tea',
  'pasta': 'Pasta',
  'quinoa': 'Cereals and Pasta',
  'cereal': 'Cereals and Pasta',
  'pancake': 'Baking and Cooking',
  'bread': 'Bread',
  'oil': 'Cooking Oils',
  'olive': 'Cooking Oils',
  'tortillas': 'International Groceries',

  // Fridge/Freezer items
  'freezer': 'Freezer',
  'frozen': 'Freezer',
  'fridge': 'Food Fridge',
  'dairy': 'Dairy Fridge',

  // Drinks
  'drink': 'Drinks Fridge',
  'drinks': 'Drinks Fridge',
  'beverage': 'Drinks Fridge',

  // Other categories
  'supplement': 'Supplements',
  'vitamin': 'Supplements',
  'confection': 'Confectionary',
  'chocolate': 'Choc and Confectionary',
  'chip': 'Chips',
  'cracker': 'Crackers',
  'cooking': 'Baking and Cooking',
  'baking': 'Baking and Cooking',
  'tin': 'Tins',
  'can': 'Tins',
  'fruit': 'Fruit and Veg',
  'veg': 'Fruit and Veg',
  'nut': 'Nut Blue Shelf',
  'mushroom': 'Mushrooms',
  'milk': 'Alt Milks',
  'soap': 'Soap',
  'clean': 'Home and Cleaning',
  'cosmetic': 'Cosmetics',
  'incense': 'Incense',
  'candle': 'Candles',
  'baby': 'Baby',
  'weleda': 'Weleda',

  // NOTE: Removed 'grocery'/'groceries' mapping as it's too generic and circular
};

function suggestSubcategory(category: string, itemName: string): string | null {
  const searchText = `${category} ${itemName}`.toLowerCase();

  for (const [keyword, subcategory] of Object.entries(SUBCATEGORY_MAPPINGS)) {
    if (searchText.includes(keyword)) {
      return subcategory;
    }
  }

  return null;
}

async function main() {
  console.log('Finding items with subcategory="Shelf"...\n');

  const shelfItems = await prisma.item.findMany({
    where: {
      subcategory: 'Shelf',
    },
  });

  console.log(`Found ${shelfItems.length} items to fix\n`);

  const results = {
    updated: [] as any[],
    noMatch: [] as any[],
  };

  for (const item of shelfItems) {
    const suggestedSubcategory = suggestSubcategory(item.category, item.name);

    if (suggestedSubcategory) {
      await prisma.item.update({
        where: { id: item.id },
        data: { subcategory: suggestedSubcategory },
      });

      results.updated.push({
        name: item.name,
        category: item.category,
        oldSubcategory: 'Shelf',
        newSubcategory: suggestedSubcategory,
      });

      console.log(`✓ ${item.name}`);
      console.log(`  Shelf → ${suggestedSubcategory}\n`);
    } else {
      results.noMatch.push({
        name: item.name,
        category: item.category,
      });

      console.log(`✗ ${item.name}`);
      console.log(`  No keyword match found\n`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${results.updated.length}`);
  console.log(`No match: ${results.noMatch.length}`);

  if (results.noMatch.length > 0) {
    console.log('\nItems without matches (kept as "Shelf"):');
    results.noMatch.forEach(item => {
      console.log(`  - ${item.name} (${item.category})`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
