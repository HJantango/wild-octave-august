import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';
import { z } from 'zod';

const UpdateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  contactInfo: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    contactPerson: z.string().optional(),
  }).optional(),
  paymentTerms: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        orderSettings: true,
        _count: {
          select: {
            items: true,
            invoices: true,
            purchaseOrders: true,
          }
        }
      }
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor' },
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
    const validatedData = UpdateVendorSchema.parse(body);

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name: validatedData.name,
        contactInfo: validatedData.contactInfo,
        paymentTerms: validatedData.paymentTerms,
      },
      include: {
        orderSettings: true,
        _count: {
          select: {
            items: true,
            invoices: true,
            purchaseOrders: true,
          }
        }
      }
    });

    return NextResponse.json(vendor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor' },
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

    await prisma.vendor.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor' },
      { status: 500 }
    );
  }
}
