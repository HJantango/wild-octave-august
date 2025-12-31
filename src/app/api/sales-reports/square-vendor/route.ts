import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';

// Subcategory (Shelf Location) suggestions based on category keywords
// Ordered by specificity - most specific patterns first to avoid false matches
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

  // NOTE: Removed generic 'grocery'/'groceries' mapping as it's too broad and circular
  // (category is often "Groceries" so it would match itself, not useful for shelf location)
};

// Default markup ratios by category for reverse-calculating cost from sell price
const DEFAULT_MARKUPS: Record<string, number> = {
  'House': 1.65,
  'Bulk': 1.75,
  'Groceries': 1.65,
  'Fridge & Freezer': 1.50,
  'Cafe Food': 2.00,
  'Cafe': 2.00,
  'Drinks': 1.60,
  'Default': 1.65,
};

function getDefaultMarkup(category: string): number {
  return DEFAULT_MARKUPS[category] || DEFAULT_MARKUPS['Default'];
}

function suggestSubcategory(category: string, itemName: string): string | null {
  const searchText = `${category} ${itemName}`.toLowerCase();

  for (const [keyword, subcategory] of Object.entries(SUBCATEGORY_MAPPINGS)) {
    if (searchText.includes(keyword)) {
      return subcategory;
    }
  }

  return null;
}

async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return createErrorResponse('NO_FILE', 'No files uploaded', 400);
    }

    const results = {
      created: [] as any[],
      updated: [] as any[],
      skipped: [] as any[],
      errors: [] as any[],
      weeklyData: [] as any[],
    };

    // Track sales data across weeks for averaging
    const itemSalesData = new Map<string, {
      itemName: string;
      vendorName: string;
      category: string;
      weeks: number[];
      totalUnits: number;
      avgPrice: number;
    }>();

    // Process each CSV file (one per week)
    for (let weekIndex = 0; weekIndex < files.length; weekIndex++) {
      const file = files[weekIndex];
      const csvText = await file.text();
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      results.weeklyData.push({
        week: weekIndex + 1,
        fileName: file.name,
        recordCount: records.length,
      });

      // Process each row
      for (const row of records) {
        try {
          const vendorName = row['Vendor Name'];
          const itemName = row['Item Name'];
          const category = row['Category'];
          const unitsSold = parseInt(row['Units Sold'] || '0');
          const netSales = parseFloat(row['Net Sales']?.replace(/[$,]/g, '') || '0');
          const grossSales = parseFloat(row['Gross Sales']?.replace(/[$,]/g, '') || '0');

          // Skip if essential fields are missing
          if (!itemName || !category || unitsSold === 0) {
            continue;
          }

          // Track sales data across weeks
          const itemKey = `${vendorName}|${itemName}`;
          if (!itemSalesData.has(itemKey)) {
            itemSalesData.set(itemKey, {
              itemName,
              vendorName,
              category,
              weeks: [],
              totalUnits: 0,
              avgPrice: 0,
            });
          }

          const itemData = itemSalesData.get(itemKey)!;
          itemData.weeks.push(unitsSold);
          itemData.totalUnits += unitsSold;
          if (grossSales > 0 && unitsSold > 0) {
            itemData.avgPrice = grossSales / unitsSold;
          }
        } catch (error: any) {
          // Skip individual row errors during data collection
          continue;
        }
      }
    }

    // Now process aggregated data and create/update items
    for (const [itemKey, salesData] of itemSalesData.entries()) {
      try {
        const { itemName, vendorName, category, weeks, totalUnits, avgPrice } = salesData;

        // Skip if no meaningful data
        if (totalUnits === 0 || !avgPrice) {
          results.skipped.push({
            itemName,
            reason: 'No sales data or price information',
          });
          continue;
        }

        // Find or create vendor
        let vendor = null;
        if (vendorName) {
          vendor = await prisma.vendor.upsert({
            where: { name: vendorName },
            update: {},
            create: { name: vendorName },
          });
        }

        // Suggest subcategory
        const suggestedSubcategory = suggestSubcategory(category, itemName);

        // Check if item exists (match by name)
        const existingItem = await prisma.item.findFirst({
          where: {
            name: {
              equals: itemName,
              mode: 'insensitive',
            },
          },
        });

        if (existingItem) {
          // Update existing item with new category/subcategory
          const updated = await prisma.item.update({
            where: { id: existingItem.id },
            data: {
              category,
              subcategory: suggestedSubcategory || existingItem.subcategory,
              vendorId: vendor?.id || existingItem.vendorId,
            },
          });

          results.updated.push({
            id: updated.id,
            name: updated.name,
            category: updated.category,
            subcategory: updated.subcategory,
            previousCategory: existingItem.category,
            weeklyUnits: weeks,
            avgWeekly: (totalUnits / weeks.length).toFixed(1),
          });
        } else {
          // CREATE NEW ITEM with estimated pricing
          // Sell price (inc GST) from Square data
          const sellIncGst = new Decimal(avgPrice);

          // Calculate sell price ex GST (assuming 10% GST)
          const sellExGst = sellIncGst.div(1.1);

          // Get default markup for this category
          const defaultMarkup = getDefaultMarkup(category);

          // Reverse-calculate cost from sell price and markup
          // sellExGst = costExGst * markup
          // costExGst = sellExGst / markup
          const costExGst = sellExGst.div(defaultMarkup);

          const newItem = await prisma.item.create({
            data: {
              name: itemName,
              vendorId: vendor?.id,
              category,
              subcategory: suggestedSubcategory,
              currentCostExGst: costExGst,
              currentMarkup: new Decimal(defaultMarkup),
              currentSellExGst: sellExGst,
              currentSellIncGst: sellIncGst,
            },
          });

          results.created.push({
            id: newItem.id,
            name: newItem.name,
            category: newItem.category,
            subcategory: newItem.subcategory,
            sellPrice: sellIncGst.toFixed(2),
            estimatedCost: costExGst.toFixed(2),
            markup: defaultMarkup,
            weeklyUnits: weeks,
            avgWeekly: (totalUnits / weeks.length).toFixed(1),
            note: 'Pricing estimated - please review',
          });
        }
      } catch (error: any) {
        results.errors.push({
          itemName: salesData.itemName,
          error: error.message,
        });
      }
    }

    return createSuccessResponse({
      summary: {
        total: itemSalesData.size,
        weeks: files.length,
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    }, 'Square vendor CSV processed successfully');
  } catch (error: any) {
    console.error('Square vendor CSV import error:', error);
    return createErrorResponse(
      'CSV_IMPORT_ERROR',
      `Failed to import CSV: ${error.message}`,
      500
    );
  }
}

export { POST };
export const dynamic = 'force-dynamic';
