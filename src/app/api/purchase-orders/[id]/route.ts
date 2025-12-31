import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            contactInfo: true,
            paymentTerms: true,
          }
        },
        lineItems: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true,
                sku: true,
              }
            }
          }
        },
        linkedInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          }
        }
      }
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // If line items are being updated, handle them in a transaction
    if (body.lineItems) {
      const { Decimal } = require('@prisma/client/runtime/library');

      // Calculate totals
      let subtotalExGst = new Decimal(0);
      const processedLineItems = body.lineItems
        .filter((item: any) => !item.id?.startsWith('temp-')) // Filter out temporary IDs
        .map((item: any) => {
          const quantity = new Decimal(item.quantity);
          const unitCost = new Decimal(item.unitCostExGst);
          const totalCost = quantity.mul(unitCost);
          subtotalExGst = subtotalExGst.add(totalCost);

          return {
            itemId: item.itemId || null,
            name: item.name,
            quantity,
            unitCostExGst: unitCost,
            totalCostExGst: totalCost,
            notes: item.notes || null,
          };
        });

      const gstAmount = subtotalExGst.mul(new Decimal(0.1));
      const totalIncGst = subtotalExGst.add(gstAmount);

      // Update purchase order with new line items in a transaction
      const purchaseOrder = await prisma.$transaction(async (tx) => {
        // Delete existing line items
        await tx.purchaseOrderLineItem.deleteMany({
          where: { purchaseOrderId: id }
        });

        // Update purchase order with new totals and create new line items
        return await tx.purchaseOrder.update({
          where: { id },
          data: {
            subtotalExGst,
            gstAmount,
            totalIncGst,
            status: body.status,
            expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
            notes: body.notes,
            lineItems: {
              create: processedLineItems
            }
          },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                contactInfo: true,
                paymentTerms: true,
              }
            },
            lineItems: {
              include: {
                item: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    sku: true,
                  }
                }
              }
            },
            linkedInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
              }
            }
          }
        });
      });

      return NextResponse.json(purchaseOrder);
    } else {
      // Simple update without line items
      const purchaseOrder = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: body.status,
          expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined,
          notes: body.notes,
        },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              contactInfo: true,
              paymentTerms: true,
            }
          },
          lineItems: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  sku: true,
                }
              }
            }
          },
          linkedInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            }
          }
        }
      });

      return NextResponse.json(purchaseOrder);
    }
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.purchaseOrder.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
