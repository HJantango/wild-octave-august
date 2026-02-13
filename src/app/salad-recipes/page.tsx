'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface Recipe {
  id: string;
  name: string;
  emoji: string;
  ingredients: string[];
  steps: string[];
  dressingOptions: string[];
  tips?: string[];
}

const recipes: Recipe[] = [
  {
    id: 'dill-potato-salad',
    name: 'Dill Potato Salad',
    emoji: '🥔',
    ingredients: [
      '2kg potatoes (skin on)',
      '1 jar Naked Baren Foods Aioli',
      '¼ cup lemon juice or apple cider vinegar',
      'Fresh dill (a whole bunch, finely chopped)',
      'Dill pickles (diced into small pieces)',
      'Red onion or spring onion (finely diced)',
      'Salt & pepper (generous!)',
    ],
    steps: [
      'Brush dirt off potatoes in hot water in the sink',
      'Prick holes in each potato with a fork (helps them cook soft inside)',
      'Boil potatoes with skins on - takes a long time, check every 10-20 mins',
      'Once boiled, transfer to a silver bowl and cool in the cool room',
      'Make the sauce: empty aioli jar into a bowl',
      'Fill the empty aioli jar ¼ to ½ way with lemon juice or apple cider vinegar, add to bowl',
      'Add lots of salt, finely chopped dill, diced pickles, and diced onion',
      'Mix sauce together well',
      'Once potatoes are cool, cut into chunks and mix with sauce',
      'Pop into containers and refrigerate',
    ],
    dressingOptions: [
      'Sauce is built-in: aioli + lemon/vinegar base',
    ],
    tips: [
      'Be generous with the salt and pepper!',
      'Use the empty aioli jar to measure the lemon juice/vinegar',
      'Make sure potatoes are properly cooled before mixing with sauce',
      'Pricking the potatoes is key - makes them soft and fluffy inside',
    ],
  },
  {
    id: 'zucchini-millet',
    name: 'Roasted Zucchini Salad with Millet',
    emoji: '🥒',
    ingredients: [
      'Zucchini',
      'Millet',
      'Lemon (for zest and juice)',
      'Olive oil',
      'Salt',
      'Fresh parsley',
      'Nuts (chopped)',
    ],
    steps: [
      'Slice zucchini into rings',
      'Peel a lemon and slice the zest into small pieces',
      'Toss zucchini rings and lemon zest with olive oil and salt on a baking tray',
      'Roast under the grill until crispy and dark brown',
      'Cook millet in the rice cooker',
      'Cool both the roasted zucchini and millet in the fridge',
      'Chop fresh parsley and nuts',
      'Toss everything together',
      'Dress and season before serving',
    ],
    dressingOptions: [
      'Lemon juice + olive oil + salt',
      'Balsamic dressing',
    ],
    tips: [
      'Make sure zucchini gets nice and crispy with dark brown colour',
      'Don\'t skip cooling in the fridge - keeps everything fresh',
      'Be generous with the salt!',
    ],
  },
  {
    id: 'roasted-veg-quinoa',
    name: 'Roasted Vegetable & Quinoa/Millet',
    emoji: '🎃',
    ingredients: [
      'Quinoa or Millet (whatever\'s in bulk section)',
      'Pumpkin',
      'Potato',
      'Beetroot',
      'Other veggies that need using up',
      'Olive oil',
      'Salt',
      'Pepitas/seeds or nuts',
      'Fresh parsley or dill',
      'Tinned legumes (optional)',
    ],
    steps: [
      'Cook quinoa or millet in the rice cooker',
      'Take to cool room to chill',
      'Chop pumpkin, potato, beetroot, etc. into small cubes',
      'Toss veggies in olive oil and salt',
      'Bake in oven until nice and crispy and brown',
      'Cool the roasted vegetables',
      'Combine grain and roasted veggies',
      'Add pepitas/seeds or nuts',
      'Add chopped parsley or dill',
      'If it needs bulking up, add tinned legumes',
      'Dress before serving',
    ],
    dressingOptions: [
      'Lemon + olive oil',
      'Balsamic dressing',
    ],
    tips: [
      'Great for using up veggies that need to go',
      'Use whatever grain is available in bulk',
      'Add legumes if salad looks a bit small',
    ],
  },
];

export default function SaladRecipesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">🥗 Salad Recipes</h1>
              <p className="text-green-100 text-lg">
                Fresh salad recipes for the cafe
              </p>
            </div>
            <Link href="/salad-recipes/print" target="_blank">
              <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Printer className="w-4 h-4 mr-2" />
                Print All
              </Button>
            </Link>
          </div>
        </div>

        {/* Recipe Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <CardTitle className="flex items-center gap-3">
                  <span className="text-3xl">{recipe.emoji}</span>
                  <span>{recipe.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Ingredients */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span>📦</span> Ingredients
                  </h3>
                  <ul className="grid grid-cols-2 gap-1 text-sm">
                    {recipe.ingredients.map((ingredient, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Steps */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span>👩‍🍳</span> Method
                  </h3>
                  <ol className="space-y-2 text-sm">
                    {recipe.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Dressing Options */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span>🫒</span> Dressing Options
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recipe.dressingOptions.map((dressing, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                      >
                        {dressing}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                {recipe.tips && recipe.tips.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <span>💡</span> Tips
                    </h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                      {recipe.tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span>→</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Print-friendly styles */}
        <style jsx global>{`
          @media print {
            nav, header { display: none !important; }
            .bg-gradient-to-r { background: #f0fdf4 !important; color: #166534 !important; }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
