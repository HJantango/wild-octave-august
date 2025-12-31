import { NextRequest, NextResponse } from 'next/server';
import { FreshLLMInvoiceParser } from '@/lib/fresh-llm-invoice-parser';
import { getOCRService } from '@/lib/ocr';
import { InvoiceParser } from '@/lib/invoice-parser';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { calculatePricing, getDefaultMarkup } from '@/lib/pricing';
import pdf2pic from 'pdf2pic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoiceId = params.id;
  
  try {
    // Get invoice and vendor
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { vendor: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.rawPdf) {
      return NextResponse.json({ error: 'No PDF data found for processing' }, { status: 400 });
    }

    try {
      // Try LLM-based processing first (preferred method)
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('Processing document with LLM vision model...');
        
        try {
          // Convert PDF to images for vision model
          const pageImages = await convertPdfToImages(invoice.rawPdf);
          console.log(`PDF detected with ${pageImages.length} page(s)`);
          
          // Use Fresh LLM parser
          const freshLlmParser = new FreshLLMInvoiceParser();
          const extractedInvoice = await freshLlmParser.parseInvoiceFromMultiplePages(pageImages);
          
          if (extractedInvoice && extractedInvoice.lineItems && extractedInvoice.lineItems.length > 0) {
            console.log(`LLM parsing completed - found ${extractedInvoice.lineItems.length} line items`);
            console.log(`Parsed vendor: ${extractedInvoice.vendor?.name}`);
            
            // Process the extracted items
            const result = await processExtractedItems(invoice, extractedInvoice);
            
            return NextResponse.json({
              status: 'success',
              message: 'Invoice processed successfully with LLM',
              invoiceId,
              itemCount: extractedInvoice.lineItems.length,
              vendor: extractedInvoice.vendor?.name,
              confidence: extractedInvoice.confidence
            });
          } else {
            console.log('LLM parsing returned no items, falling back to OCR');
          }
        } catch (error) {
          console.error('Error in fresh LLM invoice parsing:', error);
          console.log('LLM processing failed, falling back to OCR:', error.message);
        }
      }

      // Fallback to OCR processing
      console.log('Processing document with OCR service...');
      const ocrService = await getOCRService();
      const ocrResult = await ocrService.processDocument(invoice.rawPdf);
      
      console.log(`OCR processing completed with confidence: ${(ocrResult.confidence * 100).toFixed(2)}%`);
      
      const parsedInvoice = await InvoiceParser.parseInvoiceText(ocrResult.text);
      
      if (parsedInvoice && parsedInvoice.lineItems && parsedInvoice.lineItems.length > 0) {
        console.log(`OCR parsing found ${parsedInvoice.lineItems.length} line items`);

        // Convert OCR format to LLM format for processing
        const convertedInvoice = {
          vendor: { name: parsedInvoice.vendor?.name || invoice.vendor?.name || 'Unknown' },
          invoiceNumber: parsedInvoice.invoiceNumber || '',
          invoiceDate: parsedInvoice.invoiceDate || new Date().toISOString().split('T')[0],
          lineItems: parsedInvoice.lineItems.map(item => ({
            itemDescription: item.name,
            quantity: item.quantity,
            unitCostExGst: item.unitCostExGst,
            category: item.category,
            hasGst: item.hasGst,
            priceExGst: item.unitCostExGst * item.quantity,
            priceIncGst: item.hasGst ? (item.unitCostExGst * item.quantity * 1.1) : (item.unitCostExGst * item.quantity)
          })),
          confidence: parsedInvoice.confidence
        };
        
        const result = await processExtractedItems(invoice, convertedInvoice);
        
        return NextResponse.json({
          status: 'success',
          message: 'Invoice processed successfully with OCR',
          invoiceId,
          itemCount: convertedInvoice.lineItems.length,
          vendor: convertedInvoice.vendor.name,
          confidence: convertedInvoice.confidence
        });
      } else {
        console.log('OCR parsing returned no items');
        return NextResponse.json({
          status: 'error',
          message: 'No line items could be extracted from the invoice',
          invoiceId
        }, { status: 400 });
      }

    } catch (error) {
      console.error('Invoice processing error:', error);
      return NextResponse.json({
        status: 'error',
        message: 'Failed to process invoice',
        details: error.message,
        invoiceId
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const fs = await import('fs');
  const path = await import('path');

  // Ensure temp directory exists
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const convert = pdf2pic.fromBuffer(pdfBuffer, {
    density: 200,
    saveFilename: "page",
    savePath: tempDir,
    format: "png",
    width: 2480,
    height: 3508
  });

  const results = await convert.bulk(-1);
  console.log(`PDF detected with ${results.length} page(s)`);

  const pageImages: Buffer[] = [];

  for (let i = 0; i < results.length; i++) {
    const pageResult = results[i];
    console.log(`Converted page ${i + 1}/${results.length} successfully`);

    if (pageResult.buffer) {
      pageImages.push(pageResult.buffer);
    } else if (pageResult.path) {
      // If no buffer but path exists, read the file
      try {
        const imageBuffer = fs.readFileSync(pageResult.path);
        pageImages.push(imageBuffer);
        // Clean up the temporary file
        fs.unlinkSync(pageResult.path);
      } catch (error) {
        console.error(`Failed to read image file for page ${i + 1}:`, error);
        throw new Error(`Failed to convert page ${i + 1} to image buffer`);
      }
    } else {
      throw new Error(`Failed to convert page ${i + 1} to image buffer`);
    }
  }

  return pageImages;
}

async function processExtractedItems(invoice: any, extractedInvoice: any) {
  // Update invoice with extracted data
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'PROCESSED',
      invoiceNumber: extractedInvoice.invoiceNumber,
      invoiceDate: parseInvoiceDate(extractedInvoice.invoiceDate),
      updatedAt: new Date()
    }
  });

  // Process each line item
  for (const item of extractedInvoice.lineItems) {
    // Apply business rules for pricing
    const markup = getMarkupForCategory(item.category);
    const sellPriceExGst = item.unitCostExGst * markup;
    const sellPriceIncGst = item.hasGst ? sellPriceExGst * 1.1 : sellPriceExGst;

    // Create or update item in catalog
    const existingItem = await prisma.item.findFirst({
      where: {
        vendorId: invoice.vendorId,
        OR: [
          { 
            name: {
              contains: item.itemDescription,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    if (existingItem) {
      // Update existing item
      await prisma.item.update({
        where: { id: existingItem.id },
        data: {
          currentCostExGst: item.unitCostExGst,
          currentSellExGst: sellPriceExGst,
          currentSellIncGst: sellPriceIncGst,
          currentMarkup: markup,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new item
      await prisma.item.create({
        data: {
          vendorId: invoice.vendorId,
          sku: '',
          name: item.itemDescription,
          category: item.category,
          currentCostExGst: item.unitCostExGst,
          currentMarkup: markup,
          currentSellExGst: sellPriceExGst,
          currentSellIncGst: sellPriceIncGst
        }
      });
    }

    // Create invoice line item
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        itemDescription: item.itemDescription,
        quantity: item.quantity,
        unitCostExGst: item.unitCostExGst,
        category: item.category,
        hasGst: item.hasGst
      }
    });
  }
}

function getMarkupForCategory(category: string): number {
  // Get from settings or use defaults
  const markups: Record<string, number> = {
    'House': 1.65,
    'Bulk': 1.75,
    'Groceries': 1.65,
    'Supplements': 1.70,
    'Personal Care': 1.80,
    'Fruit & Veg': 1.60,
    'Drinks Fridge': 1.55,
    'Fresh Bread': 1.50,
    'Fridge & Freezer': 1.60
  };
  return markups[category] || 1.65;
}

function parseInvoiceDate(dateString: string | Date): Date {
  // If already a Date object, return as-is
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Ensure we have a string
  if (typeof dateString !== 'string') {
    console.warn('Invalid date format received:', typeof dateString, dateString);
    return new Date(); // Default to current date
  }
  
  // Handle YYYY-MM-DD format (ISO format)
  const isoMatch = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(dateString);
  }
  
  // Handle DD/MM/YYYY format (Australian format)
  const ddmmyyyyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Fallback to standard Date parsing
  const fallbackDate = new Date(dateString);
  if (isNaN(fallbackDate.getTime())) {
    console.warn('Unable to parse date:', dateString, 'using current date');
    return new Date();
  }
  
  return fallbackDate;
}