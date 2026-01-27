import { NextRequest, NextResponse } from 'next/server';
import { InvoiceParserV2, V2ExtractedInvoice } from '@/lib/invoice-parser-v2';
import { prisma } from '@/lib/api-utils';
import { getDefaultMarkup } from '@/lib/pricing';

export const maxDuration = 120; // Allow up to 2 min for large invoices

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoiceId = params.id;

  try {
    // Get invoice with vendor info
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { vendor: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.rawPdf) {
      return NextResponse.json({ error: 'No document data found' }, { status: 400 });
    }

    console.log(`[Process] Starting invoice ${invoiceId}...`);

    // Convert document to images for vision model
    const pageImages = await convertToImages(invoice.rawPdf);
    console.log(`[Process] Converted to ${pageImages.length} page image(s)`);

    // Parse with V2 parser
    const parser = new InvoiceParserV2();
    const vendorHint = invoice.vendor?.name !== 'Unknown Vendor' ? invoice.vendor?.name : undefined;
    const extracted = await parser.parseInvoice(pageImages, vendorHint);

    console.log(`[Process] Extracted: ${extracted.lineItems.length} items from ${extracted.vendor.name}`);

    // Match or create vendor
    const vendorId = await matchOrCreateVendor(extracted.vendor.name, invoice.vendorId);

    // Update invoice header
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vendorId,
        invoiceNumber: extracted.invoiceNumber || undefined,
        invoiceDate: new Date(extracted.invoiceDate),
        subtotalExGst: extracted.totals.subtotalExGst,
        gstAmount: extracted.totals.gstAmount,
        totalIncGst: extracted.totals.totalIncGst,
        parsedJson: extracted as any,
        status: 'PROCESSED',
        updatedAt: new Date(),
      },
    });

    // Clear any existing line items (re-processing)
    await prisma.invoiceLineItem.deleteMany({
      where: { invoiceId },
    });

    // Create line items with Square catalog matching
    let matchedCount = 0;
    for (const item of extracted.lineItems) {
      const markup = await getDefaultMarkup(item.category);
      const sellExGst = item.unitCostExGst * markup;
      const sellIncGst = item.hasGst ? sellExGst * 1.1 : sellExGst;

      // Try to match to existing catalog item
      const matchedItem = await fuzzyMatchItem(item.description, vendorId);

      await prisma.invoiceLineItem.create({
        data: {
          invoiceId,
          itemId: matchedItem?.id || null,
          name: item.description,
          quantity: item.quantity,
          unitCostExGst: item.unitCostExGst,
          effectiveUnitCostExGst: item.unitCostExGst,
          category: item.category,
          markup,
          sellExGst,
          sellIncGst,
          hasGst: item.hasGst,
          gstRate: item.hasGst ? 0.1 : 0,
          gstAmount: item.gstAmount,
          needsValidation: item.confidence < 0.8,
          validationFlags: item.notes ? [item.notes] : [],
          originalParsedData: item as any,
        },
      });

      if (matchedItem) {
        matchedCount++;
        // Update the catalog item's cost if matched
        await prisma.item.update({
          where: { id: matchedItem.id },
          data: {
            currentCostExGst: item.unitCostExGst,
            currentSellExGst: sellExGst,
            currentSellIncGst: sellIncGst,
            currentMarkup: markup,
            updatedAt: new Date(),
          },
        });
      }
    }

    console.log(`[Process] Created ${extracted.lineItems.length} line items, ${matchedCount} matched to catalog`);

    return NextResponse.json({
      status: 'success',
      data: {
        invoiceId,
        vendor: extracted.vendor.name,
        invoiceNumber: extracted.invoiceNumber,
        lineItemsCount: extracted.lineItems.length,
        matchedItems: matchedCount,
        confidence: extracted.confidence,
        totals: extracted.totals,
      },
      message: `Processed ${extracted.lineItems.length} items (${matchedCount} matched to catalog)`,
    });

  } catch (error: any) {
    console.error('[Process] Error:', error);
    
    // Update invoice status to reflect error
    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PARSED' }, // Reset to allow retry
      });
    } catch {} // Ignore update errors

    return NextResponse.json({
      status: 'error',
      error: error.message || 'Failed to process invoice',
    }, { status: 500 });
  }
}

/**
 * Convert PDF or image buffer to page images for vision model
 */
async function convertToImages(buffer: Buffer): Promise<Buffer[]> {
  // Check if it's already an image (not PDF)
  const header = buffer.toString('hex', 0, 4);
  const isPNG = header.startsWith('89504e47');
  const isJPEG = header.startsWith('ffd8ff');
  const isGIF = header.startsWith('47494638');

  if (isPNG || isJPEG || isGIF) {
    console.log('[Process] Document is an image, using directly');
    return [buffer];
  }

  // It's a PDF — convert to images
  console.log('[Process] Document is a PDF, converting pages to images...');
  
  try {
    const pdf2pic = (await import('pdf2pic')).default;
    const fs = await import('fs');
    const path = await import('path');

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const convert = pdf2pic.fromBuffer(buffer, {
      density: 200,
      saveFilename: `inv_${Date.now()}`,
      savePath: tempDir,
      format: 'png',
      width: 2480,
      height: 3508,
    });

    const results = await convert.bulk(-1);
    const images: Buffer[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.buffer) {
        images.push(result.buffer);
      } else if (result.path) {
        images.push(fs.readFileSync(result.path));
        try { fs.unlinkSync(result.path); } catch {} // Cleanup
      }
    }

    if (images.length === 0) {
      throw new Error('PDF conversion produced no images');
    }

    return images;
  } catch (error: any) {
    console.error('[Process] PDF conversion error:', error.message);
    throw new Error(`Could not convert PDF to images: ${error.message}`);
  }
}

/**
 * Match vendor name to existing vendor, or create new one
 */
async function matchOrCreateVendor(vendorName: string, currentVendorId: string): Promise<string> {
  if (!vendorName || vendorName === 'Unknown Vendor') {
    return currentVendorId;
  }

  // Try exact match first
  const exact = await prisma.vendor.findFirst({
    where: { name: { equals: vendorName, mode: 'insensitive' } },
  });
  if (exact) return exact.id;

  // Try contains match (e.g., "Horizon Foods Pty Ltd" matches "Horizon Foods")
  const partial = await prisma.vendor.findFirst({
    where: {
      OR: [
        { name: { contains: vendorName.split(' ')[0], mode: 'insensitive' } },
        { name: { contains: vendorName.split(' ').slice(0, 2).join(' '), mode: 'insensitive' } },
      ],
    },
  });
  if (partial) {
    console.log(`[Vendor] Fuzzy matched "${vendorName}" → "${partial.name}"`);
    return partial.id;
  }

  // Create new vendor
  console.log(`[Vendor] Creating new vendor: ${vendorName}`);
  const newVendor = await prisma.vendor.create({
    data: {
      name: vendorName,
      contactInfo: {},
      paymentTerms: '30 days net',
    },
  });
  return newVendor.id;
}

/**
 * Fuzzy match a line item description to existing catalog items
 */
async function fuzzyMatchItem(description: string, vendorId: string): Promise<{ id: string } | null> {
  if (!description) return null;

  // Normalize the description for matching
  const normalized = description.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 2);

  // Strategy 1: Exact name match for this vendor
  const exactMatch = await prisma.item.findFirst({
    where: {
      vendorId,
      name: { equals: description, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (exactMatch) return exactMatch;

  // Strategy 2: Contains match on first significant words
  // Use the first 3 meaningful words (skip sizes like "500g", "1L")
  const meaningfulWords = words.filter(w => !/^\d+[gkml]?[ls]?$/.test(w));
  const searchTerms = meaningfulWords.slice(0, 3);

  if (searchTerms.length >= 2) {
    const containsMatch = await prisma.item.findFirst({
      where: {
        vendorId,
        AND: searchTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });
    if (containsMatch) return containsMatch;
  }

  // Strategy 3: Broader search across all vendors (might be same product, different vendor record)
  if (searchTerms.length >= 2) {
    const broadMatch = await prisma.item.findFirst({
      where: {
        AND: searchTerms.slice(0, 2).map(term => ({
          name: { contains: term, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });
    if (broadMatch) return broadMatch;
  }

  return null;
}

export const dynamic = 'force-dynamic';
