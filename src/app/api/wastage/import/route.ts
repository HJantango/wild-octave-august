import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';

// Parse Square date format: "27/12/25 16:10"
function parseSquareDate(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hour, minute] = timePart.split(':');

  // Assume 2000s for year
  const fullYear = parseInt(year) + 2000;

  return new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
}

// Parse cost string: "$4.00" -> 4.00
function parseCost(costStr: string): number {
  if (!costStr) return 0;
  const cleaned = costStr.replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

// Parse quantity - handles both "1" and "0.855 kg"
function parseQuantity(qtyStr: string): number {
  if (!qtyStr) return 0;
  // Remove "kg" or other units
  const cleaned = qtyStr.replace(/[a-zA-Z]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

// Match item by name and variation
async function findMatchingItem(itemName: string, variationName?: string): Promise<string | null> {
  // Build search string
  let searchName = itemName;
  if (variationName && variationName.trim() !== '' && variationName !== 'Regular') {
    searchName = `${itemName} ${variationName}`;
  }

  // Try exact match first
  const exactMatch = await prisma.item.findFirst({
    where: {
      name: {
        equals: searchName,
        mode: 'insensitive',
      },
    },
  });

  if (exactMatch) return exactMatch.id;

  // Try partial match on item name only
  const partialMatch = await prisma.item.findFirst({
    where: {
      name: {
        contains: itemName,
        mode: 'insensitive',
      },
    },
  });

  return partialMatch?.id || null;
}

export async function POST(request: NextRequest) {
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
      bom: true,
    });

    const results = {
      imported: [] as any[],
      skipped: [] as any[],
      errors: [] as any[],
    };

    // Process each row
    for (const row of records) {
      try {
        const dateTimeStr = row['Date & time'];
        const itemName = row['Item name'];
        const variationName = row['Variation name'];
        const gtin = row['GTIN'];
        const sku = row['SKU'];
        const vendorName = row['Vendor'];
        const totalCostStr = row['Total Cost'];
        const location = row['Location'];
        const adjustmentType = row['Adjustment type']; // "Lost", "Damaged", "Theft"
        const adjustmentQuantityStr = row['Adjustment Quantity'];

        // Skip if essential fields are missing
        if (!dateTimeStr || !itemName || !adjustmentType || !adjustmentQuantityStr) {
          results.skipped.push({
            itemName: itemName || 'Unknown',
            reason: 'Missing required fields',
          });
          continue;
        }

        // Parse values
        const adjustmentDate = parseSquareDate(dateTimeStr);
        const quantity = new Decimal(parseQuantity(adjustmentQuantityStr));
        const totalCost = new Decimal(parseCost(totalCostStr));

        // Try to match item
        const matchedItemId = await findMatchingItem(itemName, variationName);

        // Create wastage record
        const wastageRecord = await prisma.wastageRecord.create({
          data: {
            itemId: matchedItemId,
            itemName,
            variationName: variationName || null,
            gtin: gtin || null,
            sku: sku || null,
            vendorName: vendorName || null,
            adjustmentType,
            quantity,
            totalCost,
            location: location || null,
            adjustmentDate,
          },
        });

        results.imported.push({
          id: wastageRecord.id,
          itemName,
          variation: variationName,
          type: adjustmentType,
          quantity: quantity.toFixed(2),
          cost: totalCost.toFixed(2),
          matched: !!matchedItemId,
        });
      } catch (error: any) {
        results.errors.push({
          itemName: row['Item name'] || 'Unknown',
          error: error.message,
        });
      }
    }

    return createSuccessResponse({
      summary: {
        total: records.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    }, 'Wastage data imported successfully');
  } catch (error: any) {
    console.error('Wastage import error:', error);
    return createErrorResponse(
      'WASTAGE_IMPORT_ERROR',
      `Failed to import wastage data: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
