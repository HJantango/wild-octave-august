import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest, createPaginatedResponse, handleFileUpload } from '@/lib/api-utils';
import { createInvoiceSchema, invoicesFilterSchema } from '@/lib/validations';

async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validation = validateRequest(invoicesFilterSchema, searchParams);

    if (!validation.success) {
      return validation.error;
    }

    const { page, limit, vendorId, status, startDate, endDate, needsRectification } = validation.data;

    const where: any = {};

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = startDate;
      if (endDate) where.invoiceDate.lte = endDate;
    }

    if (needsRectification) {
      switch (needsRectification) {
        case 'true':
          where.needsRectification = true;
          where.rectificationResolvedAt = null;
          break;
        case 'contacted':
          where.needsRectification = true;
          where.rectificationContactedAt = { not: null };
          where.rectificationResolvedAt = null;
          break;
        case 'resolved':
          where.needsRectification = true;
          where.rectificationResolvedAt = { not: null };
          break;
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, name: true },
          },
          lineItems: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    const invoicesWithCounts = invoices.map(invoice => ({
      ...invoice,
      rawPdf: undefined, // Don't send PDF data in list view
      lineItemCount: invoice.lineItems.length,
      lineItems: undefined,
    }));

    const paginatedResponse = createPaginatedResponse(invoicesWithCounts, total, { page, limit });

    return createSuccessResponse(paginatedResponse);
  } catch (error) {
    console.error('Invoices fetch error:', error);
    return createErrorResponse('INVOICES_FETCH_ERROR', 'Failed to fetch invoices', 500);
  }
}

async function POST(request: NextRequest) {
  try {
    // Handle file upload
    const fileResult = await handleFileUpload(
      request,
      ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'],
      50 * 1024 * 1024 // 50MB
    );

    if (!fileResult.success) {
      return fileResult.error;
    }

    const { buffer, filename } = fileResult;

    // Basic file validation
    const fileType = buffer.toString('hex', 0, 4);
    const isPDF = fileType.startsWith('25504446'); // PDF magic number
    const isImage = fileType.startsWith('89504e47') || // PNG
                   fileType.startsWith('ffd8ff') || // JPEG
                   fileType.startsWith('47494638'); // GIF
    
    if (!isPDF && !isImage) {
      return createErrorResponse('INVALID_FILE', 'File is not a valid PDF or image', 400);
    }

    // Find the first vendor or create a placeholder
    let vendor = await prisma.vendor.findFirst();
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          name: 'Unknown Vendor',
          contactInfo: {},
          paymentTerms: '30 days net',
        },
      });
    }

    // Create initial invoice record
    const invoice = await prisma.invoice.create({
      data: {
        vendorId: vendor.id, // Will be updated after OCR processing
        invoiceDate: new Date(),
        subtotalExGst: 0,
        gstAmount: 0,
        totalIncGst: 0,
        rawPdf: buffer,
        status: 'PARSED',
      },
    });

    // Return invoice ID for processing
    // In a real implementation, this would trigger OCR processing
    return createSuccessResponse(
      { 
        id: invoice.id,
        filename,
        status: 'uploaded',
        message: 'Invoice uploaded successfully. Processing will begin shortly.'
      },
      'Invoice uploaded successfully',
      201
    );

  } catch (error) {
    console.error('Invoice upload error:', error);
    return createErrorResponse('INVOICE_UPLOAD_ERROR', 'Failed to upload invoice', 500);
  }
}

export { GET, POST };
export const dynamic = 'force-dynamic';