import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';

// Extract shelf location from Categories field
// Format: "Shelf Labels > Label  Crackers, Shop > Bulk"
// We want to extract "Crackers" (after "Label ")
function extractShelfLocation(categoriesField: string): string | null {
  if (!categoriesField) return null;

  const match = categoriesField.match(/Shelf Labels\s*>\s*Label\s+(.+?)(?:,|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return createErrorResponse('NO_FILE', 'No file uploaded', 400);
    }

    // Read and parse CSV
    const csvText = await file.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM
    });

    const results = {
      created: [] as any[],
      updated: [] as any[],
      skipped: [] as any[],
      errors: [] as any[],
    };

    // Process each row
    for (const row of records) {
      try {
        const itemName = row['Item Name'];
        const unitCostStr = row['Default Unit Cost'];
        const currentQuantityStr = row['Current Quantity Wild Octave Organics'];
        const priceStr = row['Price'];
        const categoriesField = row['Categories'];
        const vendorName = row['Default Vendor Name'];
        const sku = row['Default Vendor Code'] || row['Vendor Code'] || row['vendor code']; // Try different case variations

        // Skip if essential fields are missing
        if (!itemName || !unitCostStr || !priceStr) {
          results.skipped.push({
            itemName: itemName || 'Unknown',
            reason: 'Missing required fields (name, cost, or price)',
          });
          continue;
        }

        // Parse numeric values
        const unitCost = parseFloat(unitCostStr);
        const sellPriceIncGst = parseFloat(priceStr);
        const currentQuantity = currentQuantityStr ? parseFloat(currentQuantityStr) : 0;

        // Skip if prices are invalid
        if (isNaN(unitCost) || isNaN(sellPriceIncGst) || unitCost <= 0 || sellPriceIncGst <= 0) {
          results.skipped.push({
            itemName,
            reason: 'Invalid price data',
          });
          continue;
        }

        // Extract shelf location from Categories field
        const shelfLocation = extractShelfLocation(categoriesField);

        // Calculate pricing
        const costExGst = new Decimal(unitCost);
        const sellIncGst = new Decimal(sellPriceIncGst);
        const sellExGst = sellIncGst.div(1.1); // Remove GST
        const markup = sellExGst.div(costExGst); // Calculate actual markup

        // Find or create vendor
        let vendor = null;
        if (vendorName && vendorName.trim() !== '') {
          vendor = await prisma.vendor.upsert({
            where: { name: vendorName },
            update: {},
            create: { name: vendorName },
          });
        }

        // Check if item exists (match by name, case-insensitive)
        const existingItem = await prisma.item.findFirst({
          where: {
            name: {
              equals: itemName,
              mode: 'insensitive',
            },
          },
          include: {
            inventoryItem: true,
          },
        });

        if (existingItem) {
          // Update existing item with MPL data
          const updated = await prisma.item.update({
            where: { id: existingItem.id },
            data: {
              currentCostExGst: costExGst,
              currentMarkup: markup,
              currentSellExGst: sellExGst,
              currentSellIncGst: sellIncGst,
              subcategory: shelfLocation || existingItem.subcategory,
              vendorId: vendor?.id || existingItem.vendorId,
              sku: sku || existingItem.sku, // Update SKU if provided
            },
          });

          // Update or create inventory item with current stock
          if (existingItem.inventoryItem) {
            await prisma.inventoryItem.update({
              where: { id: existingItem.inventoryItem.id },
              data: { currentStock: new Decimal(currentQuantity) },
            });
          } else {
            await prisma.inventoryItem.create({
              data: {
                itemId: existingItem.id,
                currentStock: new Decimal(currentQuantity),
              },
            });
          }

          results.updated.push({
            id: updated.id,
            name: updated.name,
            cost: costExGst.toFixed(2),
            sellPrice: sellIncGst.toFixed(2),
            markup: markup.toFixed(2),
            stock: currentQuantity,
            shelf: shelfLocation,
          });
        } else {
          // Item doesn't exist - create it
          // Determine category from shelf location or use a default
          const category = shelfLocation || categoriesField || 'Uncategorized';

          const newItem = await prisma.item.create({
            data: {
              name: itemName,
              category: category,
              subcategory: shelfLocation,
              currentCostExGst: costExGst,
              currentMarkup: markup,
              currentSellExGst: sellExGst,
              currentSellIncGst: sellIncGst,
              vendorId: vendor?.id,
              sku: sku,
            },
          });

          // Create inventory item with current stock
          await prisma.inventoryItem.create({
            data: {
              itemId: newItem.id,
              currentStock: new Decimal(currentQuantity),
            },
          });

          results.created.push({
            id: newItem.id,
            name: newItem.name,
            cost: costExGst.toFixed(2),
            sellPrice: sellIncGst.toFixed(2),
            markup: markup.toFixed(2),
            stock: currentQuantity,
            shelf: shelfLocation,
          });
        }
      } catch (error: any) {
        results.errors.push({
          itemName: row['Item Name'] || 'Unknown',
          error: error.message,
        });
      }
    }

    return createSuccessResponse({
      summary: {
        total: records.length,
        updated: results.updated.length,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    }, 'Master Product List imported successfully');
  } catch (error: any) {
    console.error('MPL import error:', error);
    return createErrorResponse(
      'MPL_IMPORT_ERROR',
      `Failed to import MPL: ${error.message}`,
      500
    );
  }
}

export { POST };
export const dynamic = 'force-dynamic';
