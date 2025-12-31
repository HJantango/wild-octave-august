import { detectPackSize } from '@/lib/pricing';

export interface ExtractedVendor {
  name: string;
  confidence: number;
}

export interface ExtractedLineItem {
  name: string;
  quantity: number;
  unitCostExGst: number;
  detectedPackSize?: number;
  effectiveUnitCostExGst: number;
  category: string;
  confidence: number;
  rawText: string;
  gstRate?: number;
  gstAmount?: number;
  hasGst?: boolean;
}

export interface ExtractedInvoice {
  vendor: ExtractedVendor;
  invoiceNumber?: string;
  invoiceDate: Date;
  lineItems: ExtractedLineItem[];
  confidence: number;
  rawText: string;
}

export class InvoiceParser {
  private static readonly VENDOR_KEYWORDS = [
    'tax invoice', 'invoice', 'bill to', 'sold to', 'customer',
    'from:', 'supplier', 'vendor', 'company'
  ];

  private static readonly ITEM_LINE_PATTERNS = [
    // Pattern for Trumps Pty Ltd format: CODE DESC QTY QTY UNIT $PRICE GST_RATE $GST $TOTAL
    /^(\w+)\s+(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\w+\s+\$(\d+\.\d{2})\s+([\d.]+)\s+\$([\d.]+)\s+\$(\d+\.\d{2})$/,
    // Pattern for United Organics format: CODE DESC QTY QTY UNIT PRICE/UNIT TOTAL
    /^(\d+)\s+(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\w+\s+(\d+\.\d{2})\/\w+\s+(\d+\.\d{2})$/,
    // Pattern for Little Valley format (flexible spacing): QTY ITEM_NO DESCRIPTION ... $PRICE ... $EXTENDED GST/FRE
    /^(\d+(?:\.\d+)?)\s+(\w+)\s+(.*?)\s+\$(\d+\.\d{2})\s+.*?\s+\$(\d+\.\d{2})\s+(GST|FRE)\s*$/,
    // Pattern: Item Name | Qty | Unit Price | Total
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+\.\d{2})\s+\$?(\d+\.\d{2})$/,
    // Pattern: Item Name    Qty    $Unit    $Total
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$(\d+\.\d{2})\s+\$(\d+\.\d{2})$/,
    // Pattern: Description | Quantity | Unit Cost | Line Total
    /^(.+?)\|\s*(\d+(?:\.\d+)?)\s*\|\s*\$?(\d+\.\d{2})\s*\|\s*\$?(\d+\.\d{2})$/,
  ];

  static async parseInvoiceText(ocrText: string): Promise<ExtractedInvoice> {
    // Store text for document type detection
    this.lastProcessedText = ocrText;
    
    const lines = ocrText.split('\n').map(line => line.trim()).filter(Boolean);
    
    const vendor = this.extractVendor(lines);
    const invoiceNumber = this.extractInvoiceNumber(lines);
    const invoiceDate = this.extractInvoiceDate(lines);
    const lineItems = this.extractLineItems(lines);
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence(vendor, lineItems);

    return {
      vendor,
      invoiceNumber,
      invoiceDate,
      lineItems,
      confidence,
      rawText: ocrText,
    };
  }

  private static extractVendor(lines: string[]): ExtractedVendor {
    // Look for vendor name in first few lines
    const headerLines = lines.slice(0, 10);
    
    // Check for specific known vendors first
    for (const line of headerLines) {
      if (line.toLowerCase().includes('little valley')) {
        return {
          name: 'Little Valley Distribution',
          confidence: 0.9,
        };
      }
      if (line.toLowerCase().includes('trumps pty')) {
        return {
          name: 'Trumps Pty Ltd',
          confidence: 0.9,
        };
      }
    }
    
    // Try to find company name patterns
    for (const line of headerLines) {
      // Skip lines with common non-vendor content
      if (this.isNonVendorLine(line)) continue;
      
      // Look for lines that might contain company names
      if (this.looksLikeCompanyName(line)) {
        return {
          name: this.cleanVendorName(line),
          confidence: 0.8,
        };
      }
    }

    // Fallback: use first substantial line
    const firstSubstantialLine = headerLines.find(line => 
      line.length > 5 && 
      !line.toLowerCase().includes('tax invoice') &&
      !line.toLowerCase().includes('invoice')
    );

    return {
      name: firstSubstantialLine ? this.cleanVendorName(firstSubstantialLine) : 'Unknown Vendor',
      confidence: firstSubstantialLine ? 0.5 : 0.1,
    };
  }

  private static extractInvoiceNumber(lines: string[]): string | undefined {
    // Look for invoice number patterns in the header
    const headerLines = lines.slice(0, 15);
    
    const invoiceNumberPatterns = [
      // Most specific patterns first
      /invoice\s+no\.\s*:?\s*(\d+)/i, // "Invoice No. : 123456" or "Invoice No: 123456"  
      /invoice\s+no\s*:?\s*(\d+)/i,   // "Invoice No : 123456" or "Invoice No: 123456"
      /invoice\s+number\s*:?\s*(\d+)/i,
      /inv\s+no\.?\s*:?\s*(\d+)/i,
      /invoice\s+#\s*(\d+)/i,
      /^invoice\s+(\d+)$/i, // "Invoice 123456" on its own line
      /tax\s+invoice\s+(\d+)/i,
      // Standalone numbers (less specific, try last)
      /^(\d{6,8})$/,  // Standalone 6-8 digit number
      /^\s*(\d{6,8})\s*$/,  // Standalone number with possible whitespace
    ];

    console.log('DEBUG: Looking for invoice number in header lines:', headerLines.slice(0, 5));

    for (const line of headerLines) {
      for (const pattern of invoiceNumberPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          console.log(`DEBUG: Found invoice number "${match[1]}" using pattern: ${pattern.toString()}`);
          return match[1];
        }
      }
    }

    console.log('DEBUG: No invoice number pattern matched');
    return undefined;
  }

  private static extractInvoiceDate(lines: string[]): Date {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
    ];

    for (const line of lines.slice(0, 20)) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            let day: number, month: number, year: number;
            
            if (pattern === datePatterns[0]) {
              // DD/MM/YYYY or MM/DD/YYYY (assume DD/MM/YYYY for AU)
              day = parseInt(match[1]);
              month = parseInt(match[2]);
              year = parseInt(match[3]);
            } else if (pattern === datePatterns[1]) {
              // YYYY/MM/DD
              year = parseInt(match[1]);
              month = parseInt(match[2]);
              day = parseInt(match[3]);
            } else {
              // DD Mon YYYY
              day = parseInt(match[1]);
              month = this.getMonthNumber(match[2]);
              year = parseInt(match[3]);
            }

            return new Date(year, month - 1, day);
          } catch {
            continue;
          }
        }
      }
    }

    // Fallback to today's date
    return new Date();
  }

  private static extractLineItems(lines: string[]): ExtractedLineItem[] {
    const lineItems: ExtractedLineItem[] = [];
    
    // Find the section with line items (usually after headers)
    const startIndex = this.findLineItemsStartIndex(lines);
    const itemLines = lines.slice(startIndex);

    console.log('DEBUG: Line items section starts at index', startIndex);
    console.log('DEBUG: Processing', itemLines.length, 'potential line item lines');
    console.log('DEBUG: First 20 item lines:', itemLines.slice(0, 20));
    
    // Look for lines that definitely contain prices and GST indicators
    const potentialItems = itemLines.filter(line => 
      line.includes('$') && (line.includes('GST') || line.includes('FRE'))
    );
    console.log('DEBUG: Lines with prices and GST indicators:', potentialItems.length);
    potentialItems.forEach((line, i) => {
      console.log(`DEBUG: Potential item ${i}: "${line}"`);
    });

    for (let i = 0; i < itemLines.length; i++) {
      const line = itemLines[i];
      
      // Skip obvious non-item lines
      if (this.isNonItemLine(line)) {
        console.log(`DEBUG: Skipping non-item line ${i}: "${line}"`);
        continue;
      }

      console.log(`DEBUG: Attempting to parse line ${i}: "${line}"`);
      const item = this.parseLineItem(line);
      if (item) {
        console.log(`DEBUG: Successfully parsed item:`, item);
        lineItems.push(item);
      } else {
        console.log(`DEBUG: Failed to parse line ${i}: "${line}"`);
      }
    }

    console.log('DEBUG: Total line items parsed:', lineItems.length);
    return lineItems;
  }

  private static parseLineItem(line: string): ExtractedLineItem | null {
    console.log(`DEBUG: Trying to parse line: "${line}"`);
    
    // Try each pattern
    for (let i = 0; i < this.ITEM_LINE_PATTERNS.length; i++) {
      const pattern = this.ITEM_LINE_PATTERNS[i];
      const match = line.match(pattern);
      console.log(`DEBUG: Pattern ${i} (${pattern.toString()}) match:`, !!match);
      
      if (match) {
        console.log(`DEBUG: Pattern ${i} matched:`, match);
        try {
          let name: string, qtyStr: string, unitPriceStr: string, gstRate = 0, gstAmount = 0;
          
          if (i === 0) {
            // Trumps Pty Ltd format: CODE DESC QTY QTY UNIT $PRICE GST_RATE $GST $TOTAL
            const [, code, desc, qty1, qty2, unitPrice, gstRateStr, gstAmountStr] = match;
            name = this.cleanProductName(desc.trim()); // Use description and clean it
            qtyStr = qty1; // Use first quantity (ordered)
            unitPriceStr = unitPrice;
            gstAmount = parseFloat(gstAmountStr || '0');
            
            // Determine if item has GST based on GST amount column (Trumps format)
            // If GST column is populated (>$0.00), item is taxed
            // If GST column is $0.00, item is GST-free
            if (gstAmount > 0) {
              // Item is taxed - calculate the rate from GST amount
              const unitPriceNum = parseFloat(unitPrice);
              const qtyNum = parseFloat(qty1);
              const lineSubtotal = unitPriceNum * qtyNum;
              gstRate = lineSubtotal > 0 ? (gstAmount / lineSubtotal) * 100 : 10; // Convert to percentage, fallback to 10%
            } else {
              // Item is GST-free (GST amount is $0.00)
              gstRate = 0;
            }
          } else if (i === 1) {
            // United Organics format: CODE DESC QTY QTY UNIT PRICE/UNIT TOTAL
            const [, code, desc, qty1, qty2, unitPrice, total] = match;
            name = this.cleanProductName(desc.trim());
            qtyStr = qty1; // Use first quantity (ordered)
            unitPriceStr = unitPrice;
            
            // United Organics doesn't show GST separately, assume fresh produce is GST-free
            gstRate = 0;
            gstAmount = 0;
          } else if (i === 2) {
            // Little Valley format: QTY ITEM_NO DESCRIPTION ... $PRICE ... $EXTENDED GST/FRE
            const [, qty, itemNo, desc, unitPrice, extendedPrice, gstIndicator] = match;
            name = this.cleanProductName(desc.trim()); // Use description only, cleaned
            qtyStr = qty;
            unitPriceStr = unitPrice;
            
            console.log(`DEBUG: Little Valley parsed - qty: ${qty}, itemNo: ${itemNo}, desc: "${desc}", unitPrice: ${unitPrice}, extended: ${extendedPrice}, gst: ${gstIndicator}`);
            
            // Determine GST based on indicator
            if (gstIndicator === 'GST') {
              gstRate = 10.0;
              const totalAmount = parseFloat(extendedPrice);
              const netAmount = totalAmount / 1.1; // Remove GST to get net amount
              gstAmount = totalAmount - netAmount;
            } else {
              // FRE = GST-free
              gstRate = 0;
              gstAmount = 0;
            }
          } else if (i >= 3) {
            // Other patterns (now indices 3+)
            const [, itemName, qty, unitPrice] = match;
            name = this.cleanProductName(itemName);
            qtyStr = qty;
            unitPriceStr = unitPrice;
            // Default assumption: 10% GST for other patterns
            gstRate = 10.0;
            gstAmount = parseFloat(unitPrice) * parseFloat(qty) * 0.1;
          }
          
          const quantity = parseFloat(qtyStr);
          const unitCostExGst = parseFloat(unitPriceStr);
          const hasGst = gstAmount > 0;

          console.log(`DEBUG: Parsed values - name: "${name}", qty: ${quantity}, unitCost: ${unitCostExGst}, gstRate: ${gstRate}%, gstAmount: $${gstAmount}`);

          // Detect pack size from item name
          const detectedPackSize = detectPackSize(name);
          const effectiveUnitCostExGst = detectedPackSize > 1 
            ? unitCostExGst / detectedPackSize 
            : unitCostExGst;

          // Try to determine category
          const category = this.guessCategory(name);

          return {
            name: name.trim(),
            quantity,
            unitCostExGst,
            detectedPackSize: detectedPackSize > 1 ? detectedPackSize : undefined,
            effectiveUnitCostExGst,
            category,
            confidence: 0.7,
            rawText: line,
            gstRate,
            gstAmount,
            hasGst,
          };
        } catch (error) {
          console.log(`DEBUG: Error parsing matched pattern ${i}:`, error);
          continue;
        }
      }
    }

    console.log(`DEBUG: No patterns matched, checking if looks like line item...`);
    
    // Try simpler patterns for items that might not have perfect formatting
    if (this.looksLikeLineItem(line)) {
      console.log(`DEBUG: Line looks like item, trying loose parsing...`);
      // Extract what we can from the line
      const item = this.parseLooseLineItem(line);
      if (item) {
        console.log(`DEBUG: Loose parsing succeeded:`, item);
        return item;
      } else {
        console.log(`DEBUG: Loose parsing failed`);
      }
    } else {
      console.log(`DEBUG: Line doesn't look like a line item`);
    }

    return null;
  }

  private static cleanProductName(rawName: string): string {
    // Remove common product code patterns at the beginning
    const cleaned = rawName
      // Remove patterns like "BOK-CCGF-001 " or "WEL-123 " or "ABC-456-XYZ "
      .replace(/^[A-Z]{2,6}(-[A-Z0-9]{1,6})*-?\d{0,3}\s+/i, '')
      // Remove patterns like "001 " or "ABC123 " at the start
      .replace(/^[A-Z]{0,3}\d{1,6}\s+/i, '')
      // Remove patterns like "CODE123: " or "ITEM-456: "
      .replace(/^[A-Z]+[-\s]?\d+:\s*/i, '')
      // Remove remaining leading codes/numbers with separators
      .replace(/^[A-Z0-9]{2,10}[-_\s]+/i, '')
      .trim();
    
    // If we cleaned too much, return the original
    return cleaned.length >= 3 ? cleaned : rawName;
  }

  private static parseLooseLineItem(line: string): ExtractedLineItem | null {
    // Look for price patterns in the line
    const priceMatches = line.match(/\$?(\d+\.\d{2})/g);
    if (!priceMatches || priceMatches.length === 0) return null;

    // Get the last price as unit cost (common pattern)
    const unitCostStr = priceMatches[priceMatches.length - 1].replace('$', '');
    const unitCostExGst = parseFloat(unitCostStr);

    // Extract item name (everything before first number/price)
    const nameMatch = line.match(/^([^0-9$]+)/);
    const rawName = nameMatch ? nameMatch[1].trim() : line.split(/[\d$]/)[0].trim();

    if (!rawName || rawName.length < 2) return null;

    // Clean the product name to remove item codes
    const name = this.cleanProductName(rawName);

    // Try to find quantity
    const qtyMatch = line.match(/\b(\d+(?:\.\d+)?)\b/);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

    const detectedPackSize = detectPackSize(name);
    const effectiveUnitCostExGst = detectedPackSize > 1 
      ? unitCostExGst / detectedPackSize 
      : unitCostExGst;

    return {
      name: name,
      quantity,
      unitCostExGst,
      detectedPackSize: detectedPackSize > 1 ? detectedPackSize : undefined,
      effectiveUnitCostExGst,
      category: this.guessCategory(name),
      confidence: 0.5,
      rawText: line,
      gstRate: 10.0, // Default assumption for loose parsing
      gstAmount: unitCostExGst * quantity * 0.1,
      hasGst: true,
    };
  }

  private static guessCategory(itemName: string): string {
    const name = itemName.toLowerCase();
    
    const categoryKeywords: Record<string, string[]> = {
      'Fruit & Veg': ['apple', 'banana', 'carrot', 'lettuce', 'tomato', 'organic', 'fresh', 'vegetable', 'fruit'],
      'Supplements': ['vitamin', 'mineral', 'supplement', 'capsule', 'tablet', 'protein', 'omega'],
      'Personal Care': ['soap', 'shampoo', 'toothpaste', 'deodorant', 'lotion', 'cream'],
      'Fridge & Freezer': ['milk', 'cheese', 'yogurt', 'frozen', 'refrigerated', 'dairy'],
      'Drinks Fridge': ['juice', 'water', 'drink', 'beverage', 'soda', 'kombucha'],
      'Fresh Bread': ['bread', 'loaf', 'baguette', 'roll', 'bakery'],
      'Bulk': ['bulk', 'kg', 'kilogram', '25kg', 'wholesale'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'Groceries'; // Default category
  }

  private static calculateConfidence(vendor: ExtractedVendor, lineItems: ExtractedLineItem[]): number {
    if (lineItems.length === 0) {
      // Check if document looks like a roster/schedule instead of invoice
      const rosterKeywords = ['roster', 'schedule', 'staff', 'shift', 'manager', 'barista', 'kitchen', 'hours', '/hr', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const textLower = this.lastProcessedText?.toLowerCase() || '';
      const rosterMatches = rosterKeywords.filter(keyword => textLower.includes(keyword)).length;
      
      if (rosterMatches >= 3) {
        // This appears to be a roster/schedule document, not an invoice
        console.warn('Document appears to be a roster/schedule rather than an invoice. Roster keywords found:', rosterMatches);
        return 0.05; // Very low confidence to indicate wrong document type
      }
      
      return 0.1;
    }
    
    const vendorConfidence = vendor.confidence;
    const itemsConfidence = lineItems.reduce((sum, item) => sum + item.confidence, 0) / lineItems.length;
    
    return (vendorConfidence + itemsConfidence) / 2;
  }

  private static lastProcessedText: string | null = null;

  // Helper methods
  private static isNonVendorLine(line: string): boolean {
    const nonVendorPatterns = [
      /^\d+$/, // Just numbers
      /^page \d+/i,
      /^total/i,
      /^subtotal/i,
      /^gst/i,
      /^tax/i,
      /^\$\d/,
    ];
    
    return nonVendorPatterns.some(pattern => pattern.test(line));
  }

  private static looksLikeCompanyName(line: string): boolean {
    // Look for patterns that suggest company names
    return (
      line.length > 3 &&
      line.length < 50 &&
      /[A-Z]/.test(line) && // Contains uppercase
      !line.includes('$') && // No prices
      !/^\d+/.test(line) && // Doesn't start with number
      !line.toLowerCase().includes('invoice') &&
      !line.toLowerCase().includes('date')
    );
  }

  private static cleanVendorName(line: string): string {
    return line
      .replace(/[^\w\s&.-]/g, '') // Remove special chars except common ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 50); // Limit length
  }

  private static findLineItemsStartIndex(lines: string[]): number {
    // Look for headers that typically precede line items
    const itemHeaderPatterns = [
      /description/i,
      /item/i,
      /product/i,
      /qty/i,
      /quantity/i,
      /unit/i,
      /price/i,
      /amount/i,
      /extended/i,
    ];

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i];
      if (itemHeaderPatterns.some(pattern => pattern.test(line))) {
        console.log(`DEBUG: Found header line at index ${i}: "${line}"`);
        return i + 1;
      }
      
      // Special case for Little Valley - look for the header row that contains all column names
      if (line.includes('QTY') && line.includes('ITEM NO') && line.includes('DESCRIPTION') && line.includes('PRICE')) {
        console.log(`DEBUG: Found Little Valley header row at index ${i}: "${line}"`);
        return i + 1;
      }
    }

    console.log('DEBUG: No header found, using fallback start index 10');
    // Fallback: assume items start after first 10 lines
    return Math.min(10, lines.length);
  }

  private static isNonItemLine(line: string): boolean {
    const nonItemPatterns = [
      /^total/i,
      /^subtotal/i,
      /^gst/i,
      /^tax/i,
      /^freight/i,
      /^shipping/i,
      /^delivery/i,
      /^thank you/i,
      /^payment/i,
      /^remittance/i,
      /^page \d+/i,
      /^\s*$/, // Empty lines
      /^-+$/, // Separator lines
      /^=+$/, // Separator lines
      /discount/i, // Discount lines
      /pls call/i, // Delivery instructions
      /gates opened/i, // Delivery instructions
    ];
    
    return nonItemPatterns.some(pattern => pattern.test(line)) || line.length < 3;
  }

  private static looksLikeLineItem(line: string): boolean {
    // Must contain at least one price and some text
    return (
      line.length > 10 &&
      /\$?\d+\.\d{2}/.test(line) && // Contains price
      /[A-Za-z]{3,}/.test(line) && // Contains meaningful text
      !this.isNonItemLine(line)
    );
  }

  private static getMonthNumber(monthStr: string): number {
    const months: Record<string, number> = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    };
    return months[monthStr.toLowerCase()] || 1;
  }
}