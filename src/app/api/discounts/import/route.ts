import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';

// Parse Square date format - handles both "27/12/25 16:10" and "2025-12-27"
function parseSquareDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Format: "27/12/25 16:10"
  if (dateStr.includes('/') && dateStr.includes(' ')) {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute] = timePart.split(':');
    const fullYear = parseInt(year) + 2000;
    return new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }

  // Format: "2025-12-27" or "2025-12-27 16:10"
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }

  // Fallback
  return new Date(dateStr);
}

// Parse currency string: "$4.00" or "4.00" -> 4.00
function parseCurrency(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[$,]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

// Calculate discount percentage from original and final price
function calculateDiscountPercent(original: number, final: number): number {
  if (original === 0) return 0;
  return ((original - final) / original) * 100;
}

// Categorize discount by percentage only (not amount)
// Rewards Program is determined by upload source, not by amount pattern
function categorizeDiscount(percent: number): string {
  const rounded = Math.round(percent);

  // PRIORITY 1: Special case - 100% comp (free items)
  if (rounded >= 95) return '100% - Full Comp';

  // PRIORITY 2: Staff and customer discounts (exact matching for 25% and 50%)
  if (rounded === 50) return '50% Discount';
  if (rounded === 25) return '25% Discount';
  if (rounded >= 13 && rounded <= 17) return '15% - Staff Discount';
  if (rounded >= 8 && rounded <= 12) return '10% - Customer Discount';

  // For other percentages
  if (rounded > 55) return `${rounded}% - High Discount`;
  if (rounded > 30) return `${rounded}% - Moderate Discount`;
  if (rounded > 0) return `${rounded}% - Small Discount`;

  return 'Other';
}

// Match item by name
async function findMatchingItem(itemName: string, variationName?: string): Promise<string | null> {
  let searchName = itemName;
  if (variationName && variationName.trim() !== '' && variationName !== 'Regular') {
    searchName = `${itemName} ${variationName}`;
  }

  const exactMatch = await prisma.item.findFirst({
    where: {
      name: {
        equals: searchName,
        mode: 'insensitive',
      },
    },
  });

  if (exactMatch) return exactMatch.id;

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
    const discountSource = (formData.get('discountSource') as string) || 'regular';

    if (!file) {
      return createErrorResponse('NO_FILE', 'No file uploaded', 400);
    }

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

    console.log('CSV Columns:', Object.keys(records[0] || {}));

    // PASS 1: Parse all records and calculate transaction totals (for rewards validation)
    const parsedRecords: any[] = [];
    const transactionTotals = new Map<string, number>();

    for (const row of records) {
      try {
        // Flexible column mapping - handles various Square report formats
        const dateStr = row['Date'] || row['Sale Date'] || row['Date & time'] || row['Transaction Date'];
        const itemName = row['Item name'] || row['Item Name'] || row['Item'];
        const variationName = row['Variation name'] || row['Variation Name'] || row['Price Point Name'];
        const sku = row['SKU'] || row['sku'];
        const transactionId = row['Transaction ID'] || '';

        // Square Item Sales Detail format
        const productSalesStr = row['Product Sales'];
        const discountsStr = row['Discounts'];
        const netSalesStr = row['Net Sales'];
        const quantityStr = row['Qty'] || row['Quantity'] || row['Units Sold'] || '1';

        // Legacy format support
        const discountType = row['Discount Type'] || row['Discount'] || row['Type'];
        const discountAmountStr = row['Discount Amount'] || row['Discount'] || row['Amount'];
        const discountPercentStr = row['Discount Percent'] || row['Discount %'] || row['Percentage'];
        const originalPriceStr = row['Original Price'] || row['Price'] || row['Gross Sales'];
        const finalPriceStr = row['Final Price'] || row['Net Price'];

        // Skip if essential fields are missing
        if (!dateStr || !itemName) {
          results.skipped.push({
            itemName: itemName || 'Unknown',
            reason: 'Missing required fields (date or item name)',
          });
          continue;
        }

        // Parse values
        const saleDate = parseSquareDate(dateStr);
        const quantity = new Decimal(parseFloat(quantityStr) || 1);

        let discountAmount: Decimal;
        let originalPrice: Decimal | null = null;
        let finalPrice: Decimal | null = null;

        if (productSalesStr && discountsStr) {
          originalPrice = new Decimal(parseCurrency(productSalesStr));
          discountAmount = new Decimal(Math.abs(parseCurrency(discountsStr)));
          finalPrice = netSalesStr ? new Decimal(parseCurrency(netSalesStr)) : null;
        } else if (discountAmountStr) {
          discountAmount = new Decimal(parseCurrency(discountAmountStr));
          originalPrice = originalPriceStr ? new Decimal(parseCurrency(originalPriceStr)) : null;
          finalPrice = finalPriceStr ? new Decimal(parseCurrency(finalPriceStr)) : null;
        } else {
          results.skipped.push({
            itemName,
            reason: 'No discount amount found',
          });
          continue;
        }

        // Calculate discount percentage
        let discountPercent: Decimal | null = null;
        if (discountPercentStr) {
          discountPercent = new Decimal(parseFloat(discountPercentStr));
        } else if (originalPrice && originalPrice.gt(0)) {
          const percent = (discountAmount.div(originalPrice)).mul(100);
          discountPercent = percent;
        }

        // Store parsed record for second pass
        parsedRecords.push({
          itemName,
          variationName,
          sku,
          transactionId,
          discountType,
          discountPercent,
          discountAmount,
          originalPrice,
          finalPrice,
          quantity,
          saleDate,
        });

        // Track transaction total for rewards validation
        if (transactionId && discountSource === 'rewards') {
          const currentTotal = transactionTotals.get(transactionId) || 0;
          transactionTotals.set(transactionId, currentTotal + discountAmount.toNumber());
        }
      } catch (error: any) {
        results.errors.push({
          itemName: row['Item name'] || row['Item Name'] || 'Unknown',
          error: error.message,
        });
      }
    }

    // PASS 2: Create records with validated categorization
    for (const record of parsedRecords) {
      try {
        const matchedItemId = await findMatchingItem(record.itemName, record.variationName);

        // Categorize discount type
        let categorizedType = record.discountType || null;

        // If from rewards upload, validate transaction total
        if (discountSource === 'rewards' && record.transactionId) {
          const transactionTotal = transactionTotals.get(record.transactionId) || 0;

          // Check if transaction total is a $5 increment (within $0.10 tolerance)
          const remainder = transactionTotal % 5;
          const is5Increment = remainder < 0.10 || remainder > 4.90;

          if (is5Increment) {
            categorizedType = 'Rewards Program';
          } else {
            // Not a real $5 increment reward, categorize by percentage
            categorizedType = record.discountPercent ? categorizeDiscount(record.discountPercent.toNumber()) : 'Other';
            console.log(`⚠️  Non-$5 transaction: ${record.itemName} (Transaction total: $${transactionTotal.toFixed(2)})`);
          }
        }
        // Regular discount upload
        else if (discountSource === 'regular' && record.discountPercent && !record.discountType) {
          categorizedType = categorizeDiscount(record.discountPercent.toNumber());
        }

        // Create discount record
        const discountRecord = await prisma.discountRecord.create({
          data: {
            itemId: matchedItemId,
            itemName: record.itemName,
            variationName: record.variationName || null,
            sku: record.sku || null,
            discountType: categorizedType,
            discountPercent: record.discountPercent,
            discountAmount: record.discountAmount,
            originalPrice: record.originalPrice,
            finalPrice: record.finalPrice,
            quantity: record.quantity,
            saleDate: record.saleDate,
          },
        });

        results.imported.push({
          id: discountRecord.id,
          itemName: record.itemName,
          variation: record.variationName,
          discountAmount: record.discountAmount.toFixed(2),
          discountPercent: record.discountPercent?.toFixed(0),
          matched: !!matchedItemId,
          categorizedAs: categorizedType,
        });
      } catch (error: any) {
        results.errors.push({
          itemName: record.itemName,
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
    }, 'Discount data imported successfully');
  } catch (error: any) {
    console.error('Discount import error:', error);
    return createErrorResponse(
      'DISCOUNT_IMPORT_ERROR',
      `Failed to import discount data: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
