import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { updateItemSchema, idSchema } from '@/lib/validations';
import { calculatePricing } from '@/lib/pricing';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, name: true, contactInfo: true },
        },
        priceHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10,
          include: {
            sourceInvoice: {
              select: { id: true, invoiceDate: true },
            },
          },
        },
      },
    });

    if (!item) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Item not found', 404);
    }

    // Add price change indicators
    const hasPriceChanged = item.priceHistory.length > 0 &&
      item.priceHistory[0].costExGst !== item.currentCostExGst;

    const itemWithPriceChange = {
      ...item,
      hasPriceChanged,
    };

    return createSuccessResponse(itemWithPriceChange);
  } catch (error) {
    console.error('Item fetch error:', error);
    return createErrorResponse('ITEM_FETCH_ERROR', 'Failed to fetch item', 500);
  }
}

async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = validateRequest(idSchema, id);

    if (!idValidation.success) {
      return idValidation.error;
    }

    const body = await request.json();
    const validation = validateRequest(updateItemSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const updateData = validation.data;

    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Item not found', 404);
    }

    // Check for duplicate SKU or barcode if provided
    if (updateData.sku || updateData.barcode) {
      const existing = await prisma.item.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(updateData.sku ? [{ sku: updateData.sku }] : []),
            ...(updateData.barcode ? [{ barcode: updateData.barcode }] : []),
          ],
        },
      });

      if (existing) {
        return createErrorResponse(
          'DUPLICATE_ITEM',
          'Another item with this SKU or barcode already exists',
          409
        );
      }
    }

    // Recalculate pricing if cost or markup changed
    let pricingUpdate = {};
    if (updateData.currentCostExGst || updateData.currentMarkup) {
      const costExGst = updateData.currentCostExGst ?? existingItem.currentCostExGst.toNumber();
      const markup = updateData.currentMarkup ?? existingItem.currentMarkup.toNumber();
      
      const pricing = calculatePricing(costExGst, markup);
      pricingUpdate = {
        currentCostExGst: pricing.costExGst,
        currentMarkup: pricing.markup,
        currentSellExGst: pricing.sellExGst,
        currentSellIncGst: pricing.sellIncGst,
      };

      // Create price history entry if cost changed
      if (updateData.currentCostExGst && 
          updateData.currentCostExGst !== existingItem.currentCostExGst.toNumber()) {
        await prisma.itemPriceHistory.create({
          data: {
            itemId: id,
            costExGst: existingItem.currentCostExGst,
            markup: existingItem.currentMarkup,
            sellExGst: existingItem.currentSellExGst,
            sellIncGst: existingItem.currentSellIncGst,
          },
        });
      }
    }

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...updateData,
        ...pricingUpdate,
      },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
    });

    return createSuccessResponse(item, 'Item updated successfully');
  } catch (error) {
    console.error('Item update error:', error);
    return createErrorResponse('ITEM_UPDATE_ERROR', 'Failed to update item', 500);
  }
}

async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        invoiceLineItems: { select: { id: true } },
      },
    });

    if (!item) {
      return createErrorResponse('ITEM_NOT_FOUND', 'Item not found', 404);
    }

    // Check if item is referenced in invoices
    if (item.invoiceLineItems.length > 0) {
      return createErrorResponse(
        'ITEM_IN_USE',
        'Cannot delete item that is referenced in invoices',
        409
      );
    }

    await prisma.item.delete({
      where: { id },
    });

    return createSuccessResponse(null, 'Item deleted successfully');
  } catch (error) {
    console.error('Item deletion error:', error);
    return createErrorResponse('ITEM_DELETE_ERROR', 'Failed to delete item', 500);
  }
}

export { GET, PATCH, DELETE };
export const dynamic = 'force-dynamic';