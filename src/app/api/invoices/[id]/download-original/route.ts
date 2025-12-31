import { NextRequest } from 'next/server';
import { prisma, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { idSchema } from '@/lib/validations';

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { rawPdf: true, invoiceNumber: true },
    });

    if (!invoice) {
      return createErrorResponse('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }

    if (!invoice.rawPdf) {
      return createErrorResponse('PDF_NOT_FOUND', 'Original PDF not found', 404);
    }

    const filename = `invoice-${invoice.invoiceNumber || id}.pdf`;
    
    return new Response(invoice.rawPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Invoice download error:', error);
    return createErrorResponse('DOWNLOAD_ERROR', 'Failed to download invoice', 500);
  }
}

export { GET };
export const dynamic = 'force-dynamic';