import { FreshLLMInvoiceParser } from './fresh-llm-invoice-parser';
import { InvoiceParser } from './invoice-parser';
import { getOCRService } from './ocr';

export interface ParsedInvoiceItem {
  itemCode?: string;
  itemDescription: string;
  quantity: number;
  unitCostExGst: number;
  category: string;
  priceExGst: number;
  priceIncGst: number;
  hasGst: boolean;
  validationConfidence: number;
  unitType?: string;
}

export interface ParsedInvoiceResult {
  vendor: {
    name: string;
    confidence: number;
  };
  invoiceNumber: string;
  invoiceDate: string;
  items: ParsedInvoiceItem[];
  confidence: number;
  requiresReview: boolean;
  reviewItems: any[];
  subtotalExGst: number;
  gstAmount: number;
  totalIncGst: number;
}

export interface ParseOptions {
  vendor?: any;
  profile?: any;
}

export class EnhancedInvoiceParser {
  private llmParser: FreshLLMInvoiceParser;
  private ocrParser: InvoiceParser;

  constructor() {
    this.llmParser = new FreshLLMInvoiceParser();
    this.ocrParser = new InvoiceParser();
  }

  async parseInvoice(imageBuffer: Buffer, options: ParseOptions = {}): Promise<ParsedInvoiceResult> {
    try {
      // Try LLM parsing first
      const llmResult = await this.tryLLMParsing(imageBuffer, options);
      if (llmResult) {
        return llmResult;
      }

      // Fall back to OCR parsing
      return await this.tryOCRParsing(imageBuffer, options);
    } catch (error) {
      console.error('Enhanced invoice parsing failed:', error);
      throw error;
    }
  }

  private async tryLLMParsing(imageBuffer: Buffer, options: ParseOptions): Promise<ParsedInvoiceResult | null> {
    try {
      const result = await this.llmParser.parseInvoiceFromMultiplePages([imageBuffer]);
      
      if (!result || !result.lineItems || result.lineItems.length === 0) {
        console.log('LLM parsing returned no items, falling back to OCR');
        return null;
      }

      // Convert to enhanced format
      const enhancedResult: ParsedInvoiceResult = {
        vendor: {
          name: result.vendor?.name || options.vendor?.name || 'Unknown Vendor',
          confidence: result.vendor?.confidence || 0.5
        },
        invoiceNumber: result.invoiceNumber || '',
        invoiceDate: result.invoiceDate || new Date().toISOString().split('T')[0],
        items: result.lineItems.map(item => ({
          itemCode: item.itemCode,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitCostExGst: item.unitCostExGst,
          category: item.category,
          priceExGst: item.priceExGst || (item.unitCostExGst * item.quantity),
          priceIncGst: item.priceIncGst || (item.hasGst ? (item.unitCostExGst * item.quantity * 1.1) : (item.unitCostExGst * item.quantity)),
          hasGst: item.hasGst,
          validationConfidence: item.validationConfidence || 0.8,
          unitType: 'EA'
        })),
        confidence: result.confidence,
        requiresReview: this.determineIfReviewNeeded(result),
        reviewItems: [],
        subtotalExGst: 0,
        gstAmount: 0,
        totalIncGst: 0
      };

      // Calculate totals
      this.calculateTotals(enhancedResult);

      return enhancedResult;
    } catch (error) {
      console.log('LLM parsing failed:', error.message);
      return null;
    }
  }

  private async tryOCRParsing(imageBuffer: Buffer, options: ParseOptions): Promise<ParsedInvoiceResult> {
    const ocrService = getOCRService();
    const ocrResult = await ocrService.processDocument(imageBuffer);
    
    const parsedItems = this.ocrParser.parseInvoiceText(ocrResult.text);

    const result: ParsedInvoiceResult = {
      vendor: {
        name: options.vendor?.name || 'Unknown Vendor',
        confidence: 0.6
      },
      invoiceNumber: this.extractInvoiceNumber(ocrResult.text) || '',
      invoiceDate: this.extractInvoiceDate(ocrResult.text) || new Date().toISOString().split('T')[0],
      items: parsedItems.map(item => ({
        itemCode: '',
        itemDescription: item.name,
        quantity: item.quantity,
        unitCostExGst: item.unitCostExGst,
        category: item.category,
        priceExGst: item.unitCostExGst * item.quantity,
        priceIncGst: item.hasGst ? (item.unitCostExGst * item.quantity * 1.1) : (item.unitCostExGst * item.quantity),
        hasGst: item.hasGst,
        validationConfidence: item.confidence || 0.6,
        unitType: 'EA'
      })),
      confidence: 0.6,
      requiresReview: true, // OCR results always need review
      reviewItems: [],
      subtotalExGst: 0,
      gstAmount: 0,
      totalIncGst: 0
    };

    this.calculateTotals(result);
    return result;
  }

  private determineIfReviewNeeded(result: any): boolean {
    // Review needed if confidence is low or if there are validation issues
    if (result.confidence < 0.8) return true;
    if (result.lineItems.some((item: any) => item.validationConfidence < 0.7)) return true;
    if (result.lineItems.length < 3) return true; // Suspiciously few items
    
    return false;
  }

  private calculateTotals(result: ParsedInvoiceResult): void {
    let subtotalExGst = 0;
    let gstAmount = 0;

    for (const item of result.items) {
      const lineTotal = item.unitCostExGst * item.quantity;
      subtotalExGst += lineTotal;
      
      if (item.hasGst) {
        gstAmount += lineTotal * 0.1; // 10% GST
      }
    }

    result.subtotalExGst = subtotalExGst;
    result.gstAmount = gstAmount;
    result.totalIncGst = subtotalExGst + gstAmount;
  }

  private extractInvoiceNumber(text: string): string | null {
    const patterns = [
      /invoice\s*#?\s*:?\s*(\d+)/i,
      /inv\s*#?\s*:?\s*(\d+)/i,
      /\b(\d{6,})\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private extractInvoiceDate(text: string): string | null {
    const patterns = [
      /date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        // Convert to YYYY-MM-DD format
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY or MM/DD/YYYY
          const day = parts[0];
          const month = parts[1];
          const year = parts[2];
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }

    return null;
  }
}