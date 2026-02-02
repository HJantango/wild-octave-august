import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { parse } from 'csv-parse/sync';

/**
 * POST /api/items/refresh-costs
 * 
 * Refresh item costs from a Square MPL CSV for a specific vendor.
 * This is used to fix costs that were incorrectly overwritten by invoice imports.
 * 
 * Body can be:
 * - FormData with 'file' (CSV) and optional 'vendorName' to filter
 * - JSON with 'vendorId' to clear costs for that vendor (reset to 0)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle CSV upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const vendorFilter = formData.get('vendorName') as string | null;

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
        updated: 0,
        skipped: 0,
        notFound: 0,
        errors: [] as string[],
      };

      for (const row of records) {
        const itemName = row['Item Name'];
        const unitCostStr = row['Default Unit Cost'];
        const vendorName = row['Default Vendor Name'];

        // Skip if filtering by vendor and doesn't match
        if (vendorFilter && vendorName?.toLowerCase() !== vendorFilter.toLowerCase()) {
          continue;
        }

        if (!itemName || !unitCostStr) {
          results.skipped++;
          continue;
        }

        const unitCost = parseFloat(unitCostStr);
        if (isNaN(unitCost) || unitCost <= 0) {
          results.skipped++;
          continue;
        }

        // Find item in database
        const item = await prisma.item.findFirst({
          where: {
            name: { equals: itemName, mode: 'insensitive' },
          },
        });

        if (!item) {
          results.notFound++;
          continue;
        }

        // Update the cost
        try {
          // Calculate new sell prices based on existing markup
          const existingMarkup = Number(item.currentMarkup) || 1.5;
          const newSellExGst = unitCost * existingMarkup;
          const newSellIncGst = newSellExGst * 1.1;

          await prisma.item.update({
            where: { id: item.id },
            data: {
              currentCostExGst: unitCost,
              currentSellExGst: newSellExGst,
              currentSellIncGst: newSellIncGst,
            },
          });
          results.updated++;
        } catch (err: any) {
          results.errors.push(`${itemName}: ${err.message}`);
        }
      }

      return createSuccessResponse({
        message: `Cost refresh complete`,
        results,
        filter: vendorFilter || 'all vendors',
      });
    } else {
      // Handle JSON request - reset costs for a vendor
      const body = await request.json();
      const { vendorId, vendorName } = body;

      if (!vendorId && !vendorName) {
        return createErrorResponse('MISSING_PARAMS', 'vendorId or vendorName required', 400);
      }

      // Find vendor
      const vendor = await prisma.vendor.findFirst({
        where: vendorId 
          ? { id: vendorId }
          : { name: { contains: vendorName, mode: 'insensitive' } },
      });

      if (!vendor) {
        return createErrorResponse('VENDOR_NOT_FOUND', 'Vendor not found', 404);
      }

      // Get count of items that will be affected
      const itemCount = await prisma.item.count({
        where: { vendorId: vendor.id },
      });

      return createSuccessResponse({
        message: `Found ${itemCount} items for vendor "${vendor.name}". Upload MPL CSV to refresh their costs.`,
        vendor: { id: vendor.id, name: vendor.name },
        itemCount,
        hint: 'POST with multipart/form-data including file=<csv> and vendorName=<name> to update costs',
      });
    }
  } catch (error: any) {
    console.error('Cost refresh error:', error);
    return createErrorResponse(
      'REFRESH_ERROR',
      `Failed to refresh costs: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
