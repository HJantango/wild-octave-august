import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';
import { z } from 'zod';
import { sendMissingItemsEmail } from '@/lib/email-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const missingItemsSchema = z.object({
  missingItems: z.array(z.string()).min(1, 'At least one missing item is required'),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = validateRequest(idSchema, id);

    if (!idValidation.success) {
      return idValidation.error;
    }

    const body = await request.json();
    const validation = validateRequest(missingItemsSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const { missingItems, notes } = validation.data;

    // Get invoice with vendor details
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: { 
          select: { 
            id: true, 
            name: true, 
            contactInfo: true 
          } 
        },
      },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    // Get vendor email from contactInfo
    let vendorEmail = null;
    if (invoice.vendor.contactInfo && typeof invoice.vendor.contactInfo === 'object') {
      vendorEmail = (invoice.vendor.contactInfo as any)?.email;
    }

    if (!vendorEmail) {
      return createErrorResponse('NO_VENDOR_EMAIL', 'No email address found for vendor', 400);
    }

    // Send missing items email
    await sendMissingItemsEmail({
      vendorEmail,
      vendorName: invoice.vendor.name,
      invoiceNumber: invoice.invoiceNumber || id,
      missingItems,
      notes,
    });

    // Update invoice with missing items
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        missingItems: missingItems,
        receivingNotes: notes,
      },
    });

    return createSuccessResponse(
      { 
        invoice: updatedInvoice,
        emailSent: true,
        vendorEmail 
      },
      'Missing items notification sent successfully'
    );

  } catch (error) {
    console.error('Missing items notification error:', error);
    return createErrorResponse('MISSING_ITEMS_ERROR', 'Failed to send missing items notification', 500);
  }
}

export const dynamic = 'force-dynamic';