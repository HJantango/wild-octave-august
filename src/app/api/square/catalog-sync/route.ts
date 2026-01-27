import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { realSquareService } from '@/services/real-square-service';

export async function POST(request: NextRequest) {
  try {
    // Fetch catalog items from Square API
    const catalogItems = await realSquareService.getCatalogItems();

    if (catalogItems.length === 0) {
      return createSuccessResponse({
        summary: { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
        details: { created: [], updated: [], skipped: [], errors: [] },
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const createdItems: any[] = [];
    const updatedItems: any[] = [];
    const skippedItems: any[] = [];
    const errorItems: any[] = [];

    for (const catalogItem of catalogItems) {
      try {
        // Check if item already exists by name
        const existingItem = await prisma.item.findFirst({
          where: { name: { equals: catalogItem.name, mode: 'insensitive' } },
        });

        if (existingItem) {
          // Update with Square catalog ID if not already set
          if (!existingItem.squareCatalogId) {
            await prisma.item.update({
              where: { id: existingItem.id },
              data: { squareCatalogId: catalogItem.id },
            });
            updated++;
            updatedItems.push({ name: catalogItem.name, action: 'linked_square_id' });
          } else {
            skipped++;
            skippedItems.push({ name: catalogItem.name, reason: 'already_exists' });
          }
        } else {
          // Get the first variation's price as default
          const defaultVariation = catalogItem.variations[0];
          const priceAmount = defaultVariation?.priceMoney?.amount || 0;
          const priceInDollars = priceAmount / 100;

          // Create new item
          await prisma.item.create({
            data: {
              name: catalogItem.name,
              category: catalogItem.category?.name || 'Uncategorized',
              currentSellIncGst: priceInDollars,
              currentSellExGst: priceInDollars / 1.1, // Remove GST
              currentCostExGst: 0, // Unknown from Square
              squareCatalogId: catalogItem.id,
              isActive: true,
            },
          });
          created++;
          createdItems.push({
            name: catalogItem.name,
            price: priceInDollars,
            category: catalogItem.category?.name,
          });
        }
      } catch (err: any) {
        errors++;
        errorItems.push({ name: catalogItem.name, error: err.message });
      }
    }

    return createSuccessResponse({
      summary: {
        total: catalogItems.length,
        created,
        updated,
        skipped,
        errors,
      },
      details: {
        created: createdItems,
        updated: updatedItems,
        skipped: skippedItems,
        errors: errorItems,
      },
    });
  } catch (error: any) {
    console.error('❌ Catalog sync error:', error);
    return createErrorResponse(
      'CATALOG_SYNC_ERROR',
      `Failed to sync catalog: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
