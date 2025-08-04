
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Define categories with their markup multipliers
  const categories = [
    { name: 'House', markup: 1.65 },
    { name: 'Bulk', markup: 1.75 },
    { name: 'Fruit & Veg', markup: 1.75 },
    { name: 'Fridge & Freezer', markup: 1.5 },
    { name: 'Naturo', markup: 1.65 },
    { name: 'Groceries', markup: 1.65 },
    { name: 'Drinks Fridge', markup: 1.65 },
    { name: 'Supplements', markup: 1.65 },
    { name: 'Personal Care', markup: 1.65 },
    { name: 'Fresh Bread', markup: 1.5 },
  ]

  // Create categories
  for (const category of categories) {
    try {
      await prisma.category.upsert({
        where: { name: category.name },
        update: { markup: category.markup },
        create: {
          name: category.name,
          markup: category.markup,
        },
      })
      console.log(`✓ Category "${category.name}" created/updated with markup ${category.markup}`)
    } catch (error) {
      console.error(`Error creating category "${category.name}":`, error)
    }
  }

  console.log('Database seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
