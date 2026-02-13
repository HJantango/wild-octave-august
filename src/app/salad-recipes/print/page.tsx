'use client';

import { useEffect } from 'react';

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
      "Don't skip cooling in the fridge - keeps everything fresh",
      'Be generous with the salt!',
    ],
  },
  {
    id: 'roasted-veg-quinoa',
    name: 'Roasted Vegetable & Quinoa/Millet',
    emoji: '🎃',
    ingredients: [
      "Quinoa or Millet (whatever's in bulk section)",
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

export default function PrintableRecipesPage() {
  useEffect(() => {
    // Auto-trigger print dialog after a short delay
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="print-recipes">
      {recipes.map((recipe, index) => (
        <div key={recipe.id} className="recipe-page">
          {/* Header */}
          <div className="recipe-header">
            <span className="recipe-emoji">{recipe.emoji}</span>
            <h1 className="recipe-title">{recipe.name}</h1>
          </div>

          <div className="recipe-content">
            {/* Ingredients */}
            <div className="recipe-section">
              <h2>📦 Ingredients</h2>
              <ul className="ingredients-list">
                {recipe.ingredients.map((ingredient, idx) => (
                  <li key={idx}>{ingredient}</li>
                ))}
              </ul>
            </div>

            {/* Method */}
            <div className="recipe-section">
              <h2>👩‍🍳 Method</h2>
              <ol className="steps-list">
                {recipe.steps.map((step, idx) => (
                  <li key={idx}>
                    <span className="step-number">{idx + 1}</span>
                    <span className="step-text">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Dressing */}
            <div className="recipe-section dressing-section">
              <h2>🫒 Dressing</h2>
              <div className="dressing-options">
                {recipe.dressingOptions.map((dressing, idx) => (
                  <span key={idx} className="dressing-tag">{dressing}</span>
                ))}
              </div>
            </div>

            {/* Tips */}
            {recipe.tips && recipe.tips.length > 0 && (
              <div className="recipe-section tips-section">
                <h2>💡 Tips</h2>
                <ul className="tips-list">
                  {recipe.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="recipe-footer">
            Wild Octave Cafe
          </div>
        </div>
      ))}

      <style jsx global>{`
        @page {
          size: A4;
          margin: 1.5cm;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
        }

        .print-recipes {
          background: white;
        }

        .recipe-page {
          page-break-after: always;
          min-height: 100vh;
          padding: 20px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .recipe-page:last-child {
          page-break-after: auto;
        }

        .recipe-header {
          text-align: center;
          padding: 20px 0 30px;
          border-bottom: 3px solid #10b981;
          margin-bottom: 30px;
        }

        .recipe-emoji {
          font-size: 64px;
          display: block;
          margin-bottom: 10px;
        }

        .recipe-title {
          font-size: 32px;
          font-weight: 700;
          color: #065f46;
          margin: 0;
        }

        .recipe-content {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        .recipe-section {
          margin-bottom: 20px;
        }

        .recipe-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #065f46;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #d1fae5;
        }

        .ingredients-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .ingredients-list li {
          padding: 6px 0;
          padding-left: 20px;
          position: relative;
          font-size: 14px;
          border-bottom: 1px solid #f0fdf4;
        }

        .ingredients-list li:before {
          content: "•";
          color: #10b981;
          font-weight: bold;
          position: absolute;
          left: 0;
        }

        .steps-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .steps-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 0;
          font-size: 13px;
          line-height: 1.4;
        }

        .step-number {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .step-text {
          padding-top: 2px;
        }

        .dressing-section {
          grid-column: 1 / -1;
        }

        .dressing-options {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .dressing-tag {
          background: #fef3c7;
          color: #92400e;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .tips-section {
          grid-column: 1 / -1;
          background: #eff6ff;
          padding: 16px;
          border-radius: 12px;
          margin-top: auto;
        }

        .tips-section h2 {
          color: #1e40af;
          border-bottom-color: #bfdbfe;
        }

        .tips-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .tips-list li {
          font-size: 13px;
          color: #1e40af;
          padding-left: 20px;
          position: relative;
        }

        .tips-list li:before {
          content: "→";
          position: absolute;
          left: 0;
        }

        .recipe-footer {
          text-align: center;
          padding-top: 20px;
          margin-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }

        /* Screen preview */
        @media screen {
          body {
            background: #f3f4f6;
            padding: 20px;
          }

          .recipe-page {
            background: white;
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border-radius: 8px;
          }
        }

        /* Print overrides */
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .recipe-page {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
