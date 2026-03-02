// Static checklist data for production (bypasses DATABASE_URL issues)
const checklistData = [
  {
    id: 1,
    name: "Kitchen / Back Daily Tasks",
    section: "kitchen", 
    frequency: "daily",
    items: [
      { id: 1, title: "Clean cooking utensils", frequency: "daily", order: 1 },
      { id: 2, title: "Pull out dishwasher", frequency: "daily", order: 2 },
      { id: 3, title: "Sweep / Mop floors", frequency: "daily", order: 3 },
      { id: 4, title: "Clean all surfaces", frequency: "daily", order: 4 },
      { id: 5, title: "Clean smoothie/juice machine", frequency: "daily", order: 5 },
      { id: 6, title: "Sink / dishes clear", frequency: "daily", order: 6 },
      { id: 7, title: "Boxes from back in kitchen before lockup", frequency: "daily", order: 7 },
      { id: 8, title: "Back door locked", frequency: "daily", order: 8 },
      { id: 9, title: "Eco refills system 33", frequency: "daily", order: 9 },
      { id: 10, title: "Clean behind kitchen fridges", frequency: "daily", order: 10 },
      { id: 11, title: "Bins emptied", frequency: "daily", order: 11 },
      { id: 12, title: "Clean toilets", frequency: "specific_days", specificDays: ["wednesday", "saturday"], order: 12 },
      { id: 13, title: "Back crates cleaned / concrete swept/hosed, drain cleared", frequency: "specific_days", specificDays: ["wednesday"], order: 13 },
      { id: 14, title: "Cutlery canisters wash properly", frequency: "specific_days", specificDays: ["monday"], order: 14 },
    ]
  },
  {
    id: 2,
    name: "Front of House Tasks", 
    section: "front",
    frequency: "daily",
    items: [
      { id: 15, title: "Clean bulk section", frequency: "daily", order: 1 },
      { id: 16, title: "Restock drinks fridge", frequency: "daily", order: 2 },
      { id: 17, title: "Clean cool room", frequency: "daily", order: 3 },
      { id: 18, title: "Clean Office", frequency: "daily", order: 4 },
      { id: 19, title: "Clean under coffee machine", frequency: "daily", order: 5 },
      { id: 20, title: "Fridge dates", frequency: "daily", order: 6 },
      { id: 21, title: "Fridge Temps", frequency: "daily", order: 7 },
      { id: 22, title: "Clean dry store", frequency: "daily", order: 8 },
      { id: 23, title: "Clean make-up shelves", frequency: "daily", order: 9 },
      { id: 24, title: "Clean under make-up shelves", frequency: "daily", order: 10 },
      { id: 25, title: "Sweep / Mop floors", frequency: "daily", order: 11 },
      { id: 26, title: "Deep clean tables and chairs", frequency: "daily", order: 12 },
      { id: 27, title: "Clean liquid bulk area and buckets", frequency: "daily", order: 13 },
      { id: 28, title: "Wrap cold display food", frequency: "daily", order: 14 },
      { id: 29, title: "Clean/wipe cold display", frequency: "daily", order: 15 },
      { id: 30, title: "Clean pie machine", frequency: "daily", order: 16 },
      { id: 31, title: "Pull cafe window closed, lock", frequency: "daily", order: 17 },
      { id: 32, title: "Sauces, cutlery etc inside", frequency: "daily", order: 18 },
      { id: 33, title: "Bring tables inside", frequency: "daily", order: 19 },
      { id: 34, title: "Clean top fridges", frequency: "daily", order: 20 },
      { id: 35, title: "Put away fruit & veg -> coolroom", frequency: "daily", order: 21 },
      { id: 36, title: "Clean toilet", frequency: "specific_days", specificDays: ["wednesday", "saturday"], order: 22 },
      { id: 37, title: "Clean front door glass", frequency: "specific_days", specificDays: ["friday"], order: 23 },
      { id: 38, title: "Deep clean scales", frequency: "specific_days", specificDays: ["friday"], order: 24 },
      { id: 39, title: "Clean display fridge", frequency: "specific_days", specificDays: ["saturday"], order: 25 },
    ]
  },
  {
    id: 3,
    name: "Barista Tasks",
    section: "barista", 
    frequency: "daily",
    items: [
      { id: 40, title: "Clean coffee machine / wipe down", frequency: "daily", order: 1 },
      { id: 41, title: "Clean grinder", frequency: "daily", order: 2 },
      { id: 42, title: "Clean milk jugs", frequency: "daily", order: 3 },
      { id: 43, title: "Clean cups and saucers", frequency: "daily", order: 4 },
      { id: 44, title: "Restock coffee beans", frequency: "daily", order: 5 },
      { id: 45, title: "Empty drip tray", frequency: "daily", order: 6 },
      { id: 46, title: "Wipe down counter and surfaces", frequency: "daily", order: 7 },
    ]
  }
];

export default function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Return static checklist templates
      res.status(200).json({ 
        templates: checklistData,
        source: "static", 
        timestamp: new Date().toISOString() 
      });
    } else {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Static checklist API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}