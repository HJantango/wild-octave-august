import { NextRequest } from 'next/server';
import { prisma, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';
import { addWatermarkToPdf } from '@/lib/pdf-watermark';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Add watermarks to PDF
    console.log(`Creating stamped PDF for invoice ${id}`);
    const { enteredPdf } = await addWatermarkToPdf(
      invoice.rawPdf,
      invoice.invoiceNumber || id,
      { includeReceived: invoice.allItemsReceived || false }
    );

    // Generate filename with vendor name and invoice number
    const vendorName = invoice.vendor?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
    const invoiceNum = invoice.invoiceNumber || id;
    const filename = `${vendorName}_${invoiceNum}_STAMPED.pdf`;

    // Return PDF as download
    return new Response(enteredPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': enteredPdf.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download stamped PDF error:', error);
    return createErrorResponse('DOWNLOAD_ERROR', 'Failed to generate stamped PDF', 500);
  }
}

export const dynamic = 'force-dynamic';