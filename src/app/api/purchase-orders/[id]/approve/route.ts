import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check if purchase order exists and is in DRAFT status
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!existingPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    if (existingPO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot approve purchase order with status: ${existingPO.status}` },
        { status: 400 }
      );
    }

    // Update status to APPROVED
    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        // Could add approvedBy and approvedAt fields in future
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            contactInfo: true,
          }
        },
        lineItems: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true,
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

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order approved successfully'
    });
  } catch (error) {
    console.error('Error approving purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to approve purchase order' },
      { status: 500 }
    );
  }
}
