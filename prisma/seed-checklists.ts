import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const checklistData = [
  {
    name: "Kitchen / Back Daily Tasks",
    section: "kitchen",
    items: [
      { title: "Clean cooking utensils", frequency: "daily" },
      { title: "Pull out dishwasher", frequency: "daily" },
      { title: "Sweep / Mop floors", frequency: "daily" },
      { title: "Clean all surfaces", frequency: "daily" },
      { title: "Clean smoothie/juice machine", frequency: "daily" },
      { title: "Sink / dishes clear", frequency: "daily" },
      { title: "Boxes from back in kitchen before lockup", frequency: "daily" },
      { title: "Back door locked", frequency: "daily" },
      { title: "Eco refills system 33", frequency: "daily" },
      { title: "Clean behind kitchen fridges", frequency: "daily" },
      { title: "Bins emptied", frequency: "daily" },
      { title: "Clean toilets", frequency: "specific_days", specificDays: ["wednesday", "saturday"] },
      { title: "Back crates cleaned / concrete swept/hosed, drain cleared", frequency: "specific_days", specificDays: ["wednesday"] },
      { title: "Cutlery canisters wash properly", frequency: "specific_days", specificDays: ["monday"] },
    ]
  },
  {
    name: "Front of House Tasks",
    section: "front",
    items: [
      { title: "Clean bulk section", frequency: "daily" },
      { title: "Restock drinks fridge", frequency: "daily" },
      { title: "Clean cool room", frequency: "daily" },
      { title: "Clean Office", frequency: "daily" },
      { title: "Clean under coffee machine", frequency: "daily" },
      { title: "Fridge dates", frequency: "daily" },
      { title: "Fridge Temps", frequency: "daily" },
      { title: "Clean dry store", frequency: "daily" },
      { title: "Clean make-up shelves", frequency: "daily" },
      { title: "Clean under make-up shelves", frequency: "daily" },
      { title: "Sweep / Mop floors", frequency: "daily" },
      { title: "Deep clean tables and chairs", frequency: "daily" },
      { title: "Clean liquid bulk area and buckets", frequency: "daily" },
      { title: "Wrap cold display food", frequency: "daily" },
      { title: "Clean/wipe cold display", frequency: "daily" },
      { title: "Clean pie machine", frequency: "daily" },
      { title: "Pull cafe window closed, lock", frequency: "daily" },
      { title: "Sauces, cutlery etc inside", frequency: "daily" },
      { title: "Bring tables inside", frequency: "daily" },
      { title: "Clean top fridges", frequency: "daily" },
      { title: "Put away fruit & veg -> coolroom", frequency: "daily" },
      { title: "Lock all doors", frequency: "daily" },
      { title: "Bins emptied - 2x front, office", frequency: "daily" },
      { title: "Clean fruit & veg fridge", frequency: "specific_days", specificDays: ["tuesday"] },
      { title: "Clean fruit & veg shelves", frequency: "specific_days", specificDays: ["thursday"] },
    ]
  },
  {
    name: "Barista Tasks",
    section: "barista",
    items: [
      { title: "Pack down machine, clean properly", frequency: "daily" },
      { title: "Clean coffee bench", frequency: "daily" },
      { title: "Empty Ice bucket", frequency: "daily" },
      { title: "Reset bells - 1x coffee machine, 1x cafe till, 1x door till", frequency: "daily" },
      { title: "Restock cutlery", frequency: "daily" },
      { title: "Clean milk containers, jugs etc", frequency: "daily" },
      { title: "Turn off machine", frequency: "daily" },
    ]
  }
];

async function seedChecklists() {
  console.log('🌱 Seeding checklists...');

  for (const template of checklistData) {
    console.log(`Creating ${template.name} checklist...`);
    
    await prisma.checklistTemplate.upsert({
      where: { 
        // Create unique constraint on name+section
        id: `seed-${template.section}`,
      },
      update: {
        name: template.name,
        items: {
          deleteMany: {},
          create: template.items.map((item, index) => ({
            title: item.title,
            frequency: item.frequency,
            specificDays: item.specificDays || [],
            sortOrder: index,
          })),
        },
      },
      create: {
        id: `seed-${template.section}`,
        name: template.name,
        section: template.section,
        items: {
          create: template.items.map((item, index) => ({
            title: item.title,
            frequency: item.frequency,
            specificDays: item.specificDays || [],
            sortOrder: index,
          })),
        },
      },
    });
  }

  console.log('✅ Checklists seeded successfully');
}

if (require.main === module) {
  seedChecklists()
    .catch((e) => {
      console.error('❌ Checklist seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedChecklists };