import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';

interface WeeklySalesData {
  itemId?: string; // Database item ID for linking to purchase orders
  itemName: string;
  variationName?: string; // Price Point Name / Variation Name from Square
  vendorName: string;
  category: string;
  subcategory?: string;
  sku?: string; // Vendor Code (from Square SKU field) for matching with MPL database
  weeks: number[]; // Units sold each week
  totalUnits: number;
  avgWeekly: number;
  sellPrice: number;
  costPrice?: number;
  margin?: number;
  marginPercent?: number;
  currentStock?: number;
  suggestedOrder: number;
  wastageQty?: number; // Total quantity lost/damaged in period
  wastageCost?: number; // Total cost of wastage
  discountQty?: number; // Total quantity sold at discount
  discountAmount?: number; // Total $ discounted
}

async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const catalogueFile = formData.get('catalogue') as File | null;
    const vendorFilter = formData.get('vendorId') as string | null;
    const orderFrequency = parseInt(formData.get('orderFrequency') as string || '1');
    const actualWeeks = parseInt(formData.get('actualWeeks') as string || files.length.toString());

    if (!files || files.length === 0) {
      return createErrorResponse('NO_FILE', 'No files uploaded', 400);
    }

    // Parse catalogue for cost prices if provided
    const catalogueCosts = new Map<string, number>(); // itemName -> cost
    if (catalogueFile) {
      const catalogueText = await catalogueFile.text();
      const catalogueRecords = parse(catalogueText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (const row of catalogueRecords) {
        const itemName = row['Item Name'];
        const defaultCost = parseFloat(row['Default Unit Cost'] || '0');
        if (itemName && defaultCost > 0) {
          catalogueCosts.set(itemName.toLowerCase(), defaultCost);
        }
      }
      console.log(`Loaded ${catalogueCosts.size} items with costs from catalogue`);
    }

    // Track sales data across weeks for each item
    const itemSalesMap = new Map<string, WeeklySalesData>();

    // Process each CSV file (one per week)
    for (let weekIndex = 0; weekIndex < files.length; weekIndex++) {
      const file = files[weekIndex];
      const csvText = await file.text();
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      // Log columns on first file for debugging
      if (weekIndex === 0 && records.length > 0) {
        console.log('CSV Columns:', Object.keys(records[0]));
      }

      // Process each row
      for (const row of records) {
        try {
          const vendorName = row['Vendor Name'] || row['Supplier Name'];
          const itemName = row['Item Name'];
          const variationName = row['Item Variation'] || row['Price Point Name'] || row['Variation Name'] || row['Variation'];
          const category = row['Category'];
          const sku = row['SKU'] || row['Sku'] || row['sku']; // Try different case variations
          const unitsSold = parseInt(row['Units Sold'] || '0');
          const grossSales = parseFloat(row['Gross Sales']?.replace(/[$,]/g, '') || '0');

          // Skip if essential fields are missing
          if (!itemName || !category) {
            continue;
          }

          // Filter by vendor if specified
          if (vendorFilter && vendorName !== vendorFilter) {
            continue;
          }

          // Track sales data - include variation name in key so each variation is tracked separately
          // This ensures items like "Pies - Gado Gado" and "Pies - Mexican Veg" appear as separate rows
          const variationKey = variationName && variationName !== 'Regular' ? variationName : '';
          const itemKey = sku && !variationKey
            ? `sku:${sku}`
            : `name:${vendorName}|${itemName}|${variationKey}`;

          if (!itemSalesMap.has(itemKey)) {
            itemSalesMap.set(itemKey, {
              itemName,
              variationName: variationName || undefined,
              vendorName,
              category,
              sku: sku || undefined,
              weeks: new Array(files.length).fill(0),
              totalUnits: 0,
              avgWeekly: 0,
              sellPrice: 0,
              suggestedOrder: 0,
            });
          }

          const itemData = itemSalesMap.get(itemKey)!;
          itemData.weeks[weekIndex] = unitsSold;
          itemData.totalUnits += unitsSold;

          // Calculate average sell price
          if (grossSales > 0 && unitsSold > 0) {
            itemData.sellPrice = grossSales / unitsSold;
          }
        } catch (error) {
          // Skip individual row errors
          continue;
        }
      }
    }

    // Get existing items from database to enrich with pricing and stock data
    // Get ALL items from database for better matching flexibility
    const dbItems = await prisma.item.findMany({
      include: {
        vendor: {
          select: { name: true },
        },
        inventoryItem: {
          select: { currentStock: true },
        },
      },
    });

    // Create two maps for matching: one by SKU (primary), one by name (fallback)
    const dbItemsBySku = new Map(
      dbItems
        .filter(item => item.sku)
        .map(item => [item.sku!.toLowerCase().trim(), item])
    );

    const dbItemsByName = new Map(
      dbItems.map(item => [item.name.toLowerCase().trim(), item])
    );

    const itemsWithSku = Array.from(itemSalesMap.values()).filter(d => d.sku).length;
    const totalItems = itemSalesMap.size;

    console.log(`Found ${dbItems.length} items in database`);
    console.log(`CSV has ${totalItems} unique items, ${itemsWithSku} with SKU`);
    console.log(`Database has ${dbItemsBySku.size} items with SKU`);
    console.log('Sample CSV items with SKU:', Array.from(itemSalesMap.values()).filter(d => d.sku).slice(0, 5).map(d => ({ name: d.itemName, sku: d.sku })));
    console.log('Sample DB items with SKU:', dbItems.filter(i => i.sku).slice(0, 5).map(i => ({ name: i.name, sku: i.sku, cost: i.currentCostExGst, subcategory: i.subcategory })));

    // Calculate averages and suggested orders
    const results: WeeklySalesData[] = [];
    for (const [itemKey, salesData] of itemSalesMap.entries()) {
      const { totalUnits, weeks } = salesData;
      // Use actualWeeks for calculating average, not the number of files uploaded
      const avgWeekly = totalUnits / actualWeeks;

      // Get database item for pricing info - match by SKU first, then fall back to name
      let dbItem = null;

      if (salesData.sku) {
        // Primary matching: by SKU
        dbItem = dbItemsBySku.get(salesData.sku.toLowerCase().trim());
        if (!dbItem && totalUnits > 10) {
          console.log(`Item not found by SKU: "${salesData.itemName}" (SKU: ${salesData.sku}, sold ${totalUnits} units)`);
        }
      } else {
        // Fallback matching: by name
        dbItem = dbItemsByName.get(salesData.itemName.toLowerCase().trim());
        if (!dbItem && totalUnits > 10) {
          console.log(`Item not found by name: "${salesData.itemName}" (no SKU, sold ${totalUnits} units)`);
        }
      }

      if (dbItem && !dbItem.currentCostExGst) {
        console.log(`Item found but no cost: "${salesData.itemName}"`);
      }

      // Calculate suggested order quantity
      // Formula: (avg weekly sales × order frequency) - current stock
      const weeksToOrder = orderFrequency; // 1=weekly, 2=fortnightly, 4=monthly
      const currentStock = dbItem?.inventoryItem?.currentStock
        ? Number(dbItem.inventoryItem.currentStock)
        : 0;
      const suggestedOrder = Math.max(
        0,
        Math.ceil(avgWeekly * weeksToOrder) - currentStock
      );

      // Calculate margin if we have pricing data
      let margin = undefined;
      let marginPercent = undefined;
      let costPrice = undefined;

      // Prioritize catalogue cost over database cost
      const catalogueCost = catalogueCosts.get(salesData.itemName.toLowerCase());
      if (catalogueCost) {
        costPrice = catalogueCost;
      } else if (dbItem) {
        costPrice = Number(dbItem.currentCostExGst);
      }

      if (dbItem) {
        const sellExGst = Number(dbItem.currentSellExGst);
        if (costPrice) {
          margin = sellExGst - costPrice;
          marginPercent = (margin / sellExGst) * 100;
        }

        salesData.itemId = dbItem.id; // Link to database item for purchase orders
        salesData.subcategory = dbItem.subcategory || undefined;
        salesData.sellPrice = Number(dbItem.currentSellIncGst);
        salesData.sku = dbItem.sku || salesData.sku; // Use DB SKU if available, fallback to CSV SKU
      }

      results.push({
        ...salesData,
        avgWeekly: parseFloat(avgWeekly.toFixed(1)),
        suggestedOrder,
        currentStock,
        costPrice,
        margin,
        marginPercent: marginPercent ? parseFloat(marginPercent.toFixed(1)) : undefined,
      });
    }

    // Fetch wastage and discount data for the analysis period
    // Calculate date range: actualWeeks back from now
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (actualWeeks * 7));

    // Fetch wastage records
    const wastageRecords = await prisma.wastageRecord.findMany({
      where: {
        adjustmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Fetch discount records
    const discountRecords = await prisma.discountRecord.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Aggregate wastage by item
    const wastageByItem = new Map<string, { qty: number; cost: number }>();
    for (const record of wastageRecords) {
      const itemId = record.itemId || `name:${record.itemName}`;
      if (!wastageByItem.has(itemId)) {
        wastageByItem.set(itemId, { qty: 0, cost: 0 });
      }
      const data = wastageByItem.get(itemId)!;
      data.qty += Number(record.quantity);
      data.cost += Number(record.totalCost);
    }

    // Aggregate discounts by item
    const discountsByItem = new Map<string, { qty: number; amount: number }>();
    for (const record of discountRecords) {
      const itemId = record.itemId || `name:${record.itemName}`;
      if (!discountsByItem.has(itemId)) {
        discountsByItem.set(itemId, { qty: 0, amount: 0 });
      }
      const data = discountsByItem.get(itemId)!;
      data.qty += Number(record.quantity);
      data.amount += Number(record.discountAmount);
    }

    // Enrich results with wastage and discount data
    for (const item of results) {
      if (item.itemId) {
        const wastageData = wastageByItem.get(item.itemId);
        if (wastageData) {
          item.wastageQty = parseFloat(wastageData.qty.toFixed(2));
          item.wastageCost = parseFloat(wastageData.cost.toFixed(2));
        }

        const discountData = discountsByItem.get(item.itemId);
        if (discountData) {
          item.discountQty = parseFloat(discountData.qty.toFixed(2));
          item.discountAmount = parseFloat(discountData.amount.toFixed(2));
        }
      }
    }

    // Sort by category, then by average weekly sales (descending)
    results.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return b.avgWeekly - a.avgWeekly;
    });

    return createSuccessResponse({
      items: results,
      summary: {
        totalItems: results.length,
        weeksAnalyzed: actualWeeks,
        filesUploaded: files.length,
        orderFrequency,
        totalSuggestedUnits: results.reduce((sum, item) => sum + item.suggestedOrder, 0),
      },
    });
  } catch (error: any) {
    console.error('Sales analysis error:', error);
    return createErrorResponse(
      'ANALYSIS_ERROR',
      `Failed to analyze sales data: ${error.message}`,
      500
    );
  }
}

export { POST };
export const dynamic = 'force-dynamic';
