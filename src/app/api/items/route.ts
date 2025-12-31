import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest, createPaginatedResponse } from '@/lib/api-utils';
import { createItemSchema, itemsFilterSchema } from '@/lib/validations';
import { calculatePricing } from '@/lib/pricing';

// GET items with filtering and pagination
async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(itemsFilterSchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { page, limit, category, vendorId, search, priceChanged } = validation.data;
    const name = searchParams.name; // Exact name match for stock updates

    // Build where clause
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (name) {
      // Exact name match (case-insensitive)
      where.name = {
        equals: name,
        mode: 'insensitive',
      };
    } else if (search) {
      // Fuzzy search across multiple fields
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // For price changed filter, we need to check if there's price history
    if (priceChanged !== undefined) {
      if (priceChanged) {
        where.priceHistory = {
          some: {},
        };
      } else {
        where.priceHistory = {
          none: {},
        };
      }
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, name: true },
          },
          inventoryItem: {
            select: {
              currentStock: true,
              minimumStock: true,
              maximumStock: true,
            },
          },
          priceHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
            select: {
              costExGst: true,
              changedAt: true,
            },
          },
        },
        orderBy: { name: 'asc' }, // Alphabetical order for easier searching
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.item.count({ where }),
    ]);

    // Add price change indicators
    const itemsWithPriceChanges = items.map(item => {
      const lastPriceChange = item.priceHistory[0];
      const hasPriceChanged = lastPriceChange && 
        lastPriceChange.costExGst !== item.currentCostExGst;

      return {
        ...item,
        priceHistory: undefined, // Remove from response
        hasPriceChanged: !!hasPriceChanged,
        lastPriceChange: lastPriceChange ? {
          previousCost: lastPriceChange.costExGst,
          changedAt: lastPriceChange.changedAt,
        } : undefined,
      };
    });

    const paginatedResponse = createPaginatedResponse(itemsWithPriceChanges, total, { page, limit });

    return createSuccessResponse(paginatedResponse);
  } catch (error) {
    console.error('Items fetch error:', error);
    return createErrorResponse('ITEMS_FETCH_ERROR', 'Failed to fetch items', 500);
  }
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(createItemSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { name, vendorId, category, currentCostExGst, currentMarkup, sku, barcode } = validation.data;

    // Calculate pricing
    const pricing = calculatePricing(currentCostExGst, currentMarkup);

    // Check for duplicate SKU or barcode if provided
    if (sku || barcode) {
      const existing = await prisma.item.findFirst({
        where: {
          OR: [
            ...(sku ? [{ sku }] : []),
            ...(barcode ? [{ barcode }] : []),
          ],
        },
      });

      if (existing) {
        return createErrorResponse(
          'DUPLICATE_ITEM',
          'Item with this SKU or barcode already exists',
          409
        );
      }
    }

    const item = await prisma.item.create({
      data: {
        name,
        vendorId,
        category,
        currentCostExGst: pricing.costExGst,
        currentMarkup: pricing.markup,
        currentSellExGst: pricing.sellExGst,
        currentSellIncGst: pricing.sellIncGst,
        sku,
        barcode,
      },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
    });

    return createSuccessResponse(item, 'Item created successfully', 201);
  } catch (error) {
    console.error('Item creation error:', error);
    return createErrorResponse('ITEM_CREATE_ERROR', 'Failed to create item', 500);
  }
}

export { GET, POST };
export const dynamic = 'force-dynamic';