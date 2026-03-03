import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    {
      id: 'kitchen_template',
      name: 'Kitchen & Back Tasks',
      section: 'kitchen',
      items: [
        { id: 'k1', title: 'Clean cooking utensils', frequency: 'daily', specificDays: [] },
        { id: 'k2', title: 'Pull out dishwasher', frequency: 'daily', specificDays: [] },
        { id: 'k3', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [] },
        { id: 'k4', title: 'Clean all surfaces', frequency: 'daily', specificDays: [] },
        { id: 'k5', title: 'Clean smoothie/juice machine', frequency: 'daily', specificDays: [] },
        { id: 'k6', title: 'Sink/dishes clear', frequency: 'daily', specificDays: [] },
        { id: 'k7', title: 'Boxes from back in kitchen before lock up', frequency: 'daily', specificDays: [] },
        { id: 'k8', title: 'Back door locked', frequency: 'daily', specificDays: [] },
        { id: 'k9', title: 'Eco refills system 33', frequency: 'daily', specificDays: [] },
        { id: 'k10', title: 'Clean behind kitchen fridges', frequency: 'weekly', specificDays: ['Wednesday'] },
        { id: 'k11', title: 'Clean toilets', frequency: 'weekly', specificDays: ['Wednesday', 'Saturday'] },
        { id: 'k12', title: 'Back crates cleaned/concrete swept/hosed, drain cleared', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'k13', title: 'Cutlery canisters wash properly', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'k14', title: 'Bins emptied', frequency: 'weekly', specificDays: ['Sunday'] }
      ]
    },
    {
      id: 'front_template',
      name: 'Front of House Tasks',
      section: 'front',
      items: [
        { id: 'f1', title: 'Clean bulk section', frequency: 'daily', specificDays: [] },
        { id: 'f2', title: 'Restock drinks fridge', frequency: 'daily', specificDays: [] },
        { id: 'f3', title: 'Clean cool room', frequency: 'daily', specificDays: [] },
        { id: 'f4', title: 'Clean Office', frequency: 'daily', specificDays: [] },
        { id: 'f5', title: 'Clean under coffee machine', frequency: 'daily', specificDays: [] },
        { id: 'f6', title: 'Fridge dates', frequency: 'daily', specificDays: [] },
        { id: 'f7', title: 'Fridge Temps', frequency: 'daily', specificDays: [] },
        { id: 'f8', title: 'Clean dry store', frequency: 'daily', specificDays: [] },
        { id: 'f9', title: 'Clean make-up shelves', frequency: 'daily', specificDays: [] },
        { id: 'f10', title: 'Clean under make-up shelves', frequency: 'daily', specificDays: [] },
        { id: 'f11', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [] },
        { id: 'f12', title: 'Deep clean tables and chairs', frequency: 'daily', specificDays: [] },
        { id: 'f13', title: 'Clean liquid bulk area and buckets', frequency: 'daily', specificDays: [] },
        { id: 'f14', title: 'Wrap cold display food', frequency: 'daily', specificDays: [] },
        { id: 'f15', title: 'Clean/wipe cold display', frequency: 'daily', specificDays: [] },
        { id: 'f16', title: 'Clean pie machine', frequency: 'daily', specificDays: [] },
        { id: 'f17', title: 'Pull cafe window closed, lock', frequency: 'daily', specificDays: [] },
        { id: 'f18', title: 'Sauces, cutlery etc inside', frequency: 'daily', specificDays: [] },
        { id: 'f19', title: 'Bring tables inside', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f20', title: 'Clean top fridges', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f21', title: 'Put away fruit & veg -> coolroom', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f22', title: 'Lock all doors', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f23', title: 'Bins emptied - 2 x front, office', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f24', title: 'Clean fruit & veg fridge', frequency: 'weekly', specificDays: ['Sunday'] },
        { id: 'f25', title: 'Clean fruit & veg shelves', frequency: 'weekly', specificDays: ['Sunday'] }
      ]
    },
    {
      id: 'barista_template',
      name: 'Barista Tasks',
      section: 'barista',
      items: [
        { id: 'b1', title: 'Clean coffee machine', frequency: 'daily', specificDays: [] },
        { id: 'b2', title: 'Empty coffee grounds', frequency: 'daily', specificDays: [] },
        { id: 'b3', title: 'Wipe down counter', frequency: 'daily', specificDays: [] },
        { id: 'b4', title: 'Restock cups and lids', frequency: 'daily', specificDays: [] },
        { id: 'b5', title: 'Clean milk steamer', frequency: 'daily', specificDays: [] },
        { id: 'b6', title: 'Deep clean espresso machine', frequency: 'weekly', specificDays: ['Saturday'] },
        { id: 'b7', title: 'Descale coffee machine', frequency: 'weekly', specificDays: ['Monday'] }
      ]
    }
  ];

  return NextResponse.json({ success: true, data });
}

export const dynamic = 'force-dynamic';