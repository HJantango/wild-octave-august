import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';
import { addWatermarkToPdf, sendInvoiceEmail } from '@/lib/pdf-watermark';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = validateRequest(idSchema, id);

    if (!validation.success) {
      return validation.error;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: { select: { name: true } },
      },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    if (!invoice.rawPdf) {
      return createErrorResponse('PDF_NOT_FOUND', 'Original PDF not found', 404);
    }

    // Get accounts email from settings
    const accountsEmailSetting = await prisma.settings.findUnique({
      where: { key: 'accounts_email' },
    });

    const accountsEmail = accountsEmailSetting?.value as string || 'accounts@wildoctave.com';

    // Add watermarks to PDF
    console.log(`Adding watermarks to invoice ${id}`);
    const { enteredPdf, sentPdf } = await addWatermarkToPdf(
      invoice.rawPdf,
      invoice.invoiceNumber || id,
      { includeReceived: invoice.allItemsReceived || false }
    );

    // Send email with watermarked PDF
    console.log(`Sending invoice ${id} to ${accountsEmail}`);
    await sendInvoiceEmail({
      to: accountsEmail,
      invoiceNumber: invoice.invoiceNumber || id,
      vendorName: invoice.vendor.name,
      totalAmount: invoice.totalIncGst,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber || id}-ENTERED.pdf`,
          content: enteredPdf,
          contentType: 'application/pdf'
        },
        {
          filename: `invoice-${invoice.invoiceNumber || id}-SENT.pdf`,
          content: sentPdf,
          contentType: 'application/pdf'
        }
      ]
    });

    // Update invoice status to mark as sent to DEXT
    await prisma.invoice.update({
      where: { id },
      data: { 
        status: 'POSTED' // or create a new status like 'SENT_TO_DEXT'
      },
    });

    return createSuccessResponse(
      { sent: true }, 
      'Invoice processed and sent to DEXT successfully'
    );
  } catch (error) {
    console.error('Send to DEXT error:', error);
    return createErrorResponse(
      'SEND_TO_DEXT_ERROR', 
      `Failed to send invoice to DEXT: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      500
    );
  }
}

export { POST };
export const dynamic = 'force-dynamic';