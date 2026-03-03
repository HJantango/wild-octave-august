import { NextRequest } from 'next/server';
import { createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  // Return hardcoded data while debugging main API
  const checklistData = [
    {
      id: 'kitchen_template',
      name: 'Kitchen & Back Tasks',
      section: 'kitchen',
      is_active: true,
      items: [
        { id: 'k1', title: 'Clean cooking utensils', frequency: 'daily', specificDays: [], sort_order: 1 },
        { id: 'k2', title: 'Pull out dishwasher', frequency: 'daily', specificDays: [], sort_order: 2 },
        { id: 'k3', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [], sort_order: 3 },
        { id: 'k4', title: 'Clean all surfaces', frequency: 'daily', specificDays: [], sort_order: 4 },
        { id: 'k5', title: 'Clean smoothie/juice machine', frequency: 'daily', specificDays: [], sort_order: 5 },
        { id: 'k6', title: 'Sink/dishes clear', frequency: 'daily', specificDays: [], sort_order: 6 },
        { id: 'k7', title: 'Boxes from back in kitchen before lock up', frequency: 'daily', specificDays: [], sort_order: 7 },
        { id: 'k8', title: 'Back door locked', frequency: 'daily', specificDays: [], sort_order: 8 },
        { id: 'k9', title: 'Eco refills system 33', frequency: 'daily', specificDays: [], sort_order: 9 },
        { id: 'k10', title: 'Clean behind kitchen fridges', frequency: 'weekly', specificDays: ['Wednesday'], sort_order: 10 },
        { id: 'k11', title: 'Clean toilets', frequency: 'weekly', specificDays: ['Wednesday', 'Saturday'], sort_order: 11 },
        { id: 'k12', title: 'Back crates cleaned/concrete swept/hosed, drain cleared', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 12 },
        { id: 'k13', title: 'Cutlery canisters wash properly', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 13 },
        { id: 'k14', title: 'Bins emptied', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 14 }
      ]
    },
    {
      id: 'front_template',
      name: 'Front of House Tasks',
      section: 'front',
      is_active: true,
      items: [
        { id: 'f1', title: 'Clean bulk section', frequency: 'daily', specificDays: [], sort_order: 1 },
        { id: 'f2', title: 'Restock drinks fridge', frequency: 'daily', specificDays: [], sort_order: 2 },
        { id: 'f3', title: 'Clean cool room', frequency: 'daily', specificDays: [], sort_order: 3 },
        { id: 'f4', title: 'Clean Office', frequency: 'daily', specificDays: [], sort_order: 4 },
        { id: 'f5', title: 'Clean under coffee machine', frequency: 'daily', specificDays: [], sort_order: 5 },
        { id: 'f6', title: 'Fridge dates', frequency: 'daily', specificDays: [], sort_order: 6 },
        { id: 'f7', title: 'Fridge Temps', frequency: 'daily', specificDays: [], sort_order: 7 },
        { id: 'f8', title: 'Clean dry store', frequency: 'daily', specificDays: [], sort_order: 8 },
        { id: 'f9', title: 'Clean make-up shelves', frequency: 'daily', specificDays: [], sort_order: 9 },
        { id: 'f10', title: 'Clean under make-up shelves', frequency: 'daily', specificDays: [], sort_order: 10 },
        { id: 'f11', title: 'Sweep/Mop floors', frequency: 'daily', specificDays: [], sort_order: 11 },
        { id: 'f12', title: 'Deep clean tables and chairs', frequency: 'daily', specificDays: [], sort_order: 12 },
        { id: 'f13', title: 'Clean liquid bulk area and buckets', frequency: 'daily', specificDays: [], sort_order: 13 },
        { id: 'f14', title: 'Wrap cold display food', frequency: 'daily', specificDays: [], sort_order: 14 },
        { id: 'f15', title: 'Clean/wipe cold display', frequency: 'daily', specificDays: [], sort_order: 15 },
        { id: 'f16', title: 'Clean pie machine', frequency: 'daily', specificDays: [], sort_order: 16 },
        { id: 'f17', title: 'Pull cafe window closed, lock', frequency: 'daily', specificDays: [], sort_order: 17 },
        { id: 'f18', title: 'Sauces, cutlery etc inside', frequency: 'daily', specificDays: [], sort_order: 18 },
        { id: 'f19', title: 'Bring tables inside', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 19 },
        { id: 'f20', title: 'Clean top fridges', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 20 },
        { id: 'f21', title: 'Put away fruit & veg -> coolroom', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 21 },
        { id: 'f22', title: 'Lock all doors', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 22 },
        { id: 'f23', title: 'Bins emptied - 2 x front, office', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 23 },
        { id: 'f24', title: 'Clean fruit & veg fridge', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 24 },
        { id: 'f25', title: 'Clean fruit & veg shelves', frequency: 'weekly', specificDays: ['Sunday'], sort_order: 25 }
      ]
    },
    {
      id: 'barista_template',
      name: 'Barista Tasks',
      section: 'barista',
      is_active: true,
      items: [
        { id: 'b1', title: 'Clean coffee machine', frequency: 'daily', specificDays: [], sort_order: 1 },
        { id: 'b2', title: 'Empty coffee grounds', frequency: 'daily', specificDays: [], sort_order: 2 },
        { id: 'b3', title: 'Wipe down counter', frequency: 'daily', specificDays: [], sort_order: 3 },
        { id: 'b4', title: 'Restock cups and lids', frequency: 'daily', specificDays: [], sort_order: 4 },
        { id: 'b5', title: 'Clean milk steamer', frequency: 'daily', specificDays: [], sort_order: 5 },
        { id: 'b6', title: 'Deep clean espresso machine', frequency: 'weekly', specificDays: ['Saturday'], sort_order: 6 },
        { id: 'b7', title: 'Descale coffee machine', frequency: 'weekly', specificDays: ['Monday'], sort_order: 7 }
      ]
    }
  ];

  return createSuccessResponse(checklistData);
}

export const dynamic = 'force-dynamic';