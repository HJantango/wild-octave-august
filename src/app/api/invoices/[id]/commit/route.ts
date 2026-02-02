import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest, withTransaction } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    // Find invoice with line items
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        vendor: { select: { id: true, name: true } },
      },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    if (invoice.status === 'POSTED') {
      return createErrorResponse('ALREADY_COMMITTED', 'Invoice has already been committed', 409);
    }

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      return createErrorResponse('NO_LINE_ITEMS', 'Invoice has no line items to commit', 400);
    }

    // Commit the invoice - update or create items and track price changes
    const result = await withTransaction(async (tx) => {
      const itemsUpdated: string[] = [];
      const itemsCreated: string[] = [];
      const priceChanges: Array<{ itemName: string; oldPrice: number; newPrice: number }> = [];

      // Process each line item
      for (const lineItem of invoice.lineItems) {
        // Try to find existing item by name and vendor
        let existingItem = await tx.item.findFirst({
          where: {
            name: lineItem.name,
            vendorId: invoice.vendorId,
          },
        });

        // If not found by vendor, try by name only
        if (!existingItem) {
          existingItem = await tx.item.findFirst({
            where: {
              name: lineItem.name,
            },
          });
        }

        if (existingItem) {
          const oldCost = existingItem.currentCostExGst.toNumber();
          const newCost = lineItem.effectiveUnitCostExGst;
          
          // Only update costs if item doesn't have an existing cost
          // This preserves accurate per-unit costs from Square, avoids overwriting with box/carton prices from invoices
          const shouldUpdateCost = !oldCost || oldCost <= 0;
          
          if (shouldUpdateCost && newCost > 0) {
            // Record price history for new cost
            await tx.itemPriceHistory.create({
              data: {
                itemId: existingItem.id,
                costExGst: newCost,
                markup: lineItem.markup,
                sellExGst: lineItem.sellExGst,
                sellIncGst: lineItem.sellIncGst,
                sourceInvoiceId: invoice.id,
              },
            });

            priceChanges.push({
              itemName: lineItem.name,
              oldPrice: oldCost,
              newPrice: newCost,
            });
            
            // Update item with new pricing
            await tx.item.update({
              where: { id: existingItem.id },
              data: {
                vendorId: invoice.vendorId,
                category: lineItem.category,
                currentCostExGst: lineItem.effectiveUnitCostExGst,
                currentMarkup: lineItem.markup,
                currentSellExGst: lineItem.sellExGst,
                currentSellIncGst: lineItem.sellIncGst,
              },
            });
          } else {
            // Still update vendor association and category, just not the cost
            await tx.item.update({
              where: { id: existingItem.id },
              data: {
                vendorId: invoice.vendorId,
                category: lineItem.category,
              },
            });
          }

          // Link line item to existing item
          await tx.invoiceLineItem.update({
            where: { id: lineItem.id },
            data: { itemId: existingItem.id },
          });

          itemsUpdated.push(existingItem.id);
        } else {
          // Create new item
          const newItem = await tx.item.create({
            data: {
              name: lineItem.name,
              vendorId: invoice.vendorId,
              category: lineItem.category,
              currentCostExGst: lineItem.effectiveUnitCostExGst,
              currentMarkup: lineItem.markup,
              currentSellExGst: lineItem.sellExGst,
              currentSellIncGst: lineItem.sellIncGst,
            },
          });

          // Link line item to new item
          await tx.invoiceLineItem.update({
            where: { id: lineItem.id },
            data: { itemId: newItem.id },
          });

          itemsCreated.push(newItem.id);
        }
      }

      // Update invoice status to POSTED
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { status: 'POSTED' },
        include: {
          vendor: { select: { id: true, name: true } },
          lineItems: { include: { item: { select: { id: true, name: true } } } },
        },
      });

      return {
        invoice: updatedInvoice,
        itemsUpdated: itemsUpdated.length,
        itemsCreated: itemsCreated.length,
        priceChanges: priceChanges.length,
        details: {
          itemsUpdated,
          itemsCreated,
          priceChanges,
        },
      };
    });

    return createSuccessResponse(
      result,
      `Invoice committed successfully. ${result.itemsCreated} items created, ${result.itemsUpdated} items updated, ${result.priceChanges} price changes recorded.`
    );

  } catch (error) {
    console.error('Invoice commit error:', error);
    return createErrorResponse('COMMIT_ERROR', 'Failed to commit invoice', 500);
  }
}

export const dynamic = 'force-dynamic';