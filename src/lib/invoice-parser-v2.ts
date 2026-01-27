import Anthropic from '@anthropic-ai/sdk';

/**
 * Invoice Parser V2 — Clean, vendor-agnostic AI extraction
 * 
 * Key improvements over V1:
 * - Uses Claude Sonnet (much better vision than Haiku)
 * - Simple, focused prompt (no over-fitting to specific vendors)
 * - Vendor auto-detection from invoice content
 * - Structured output with confidence scores
 * - Learns from corrections (vendor context)
 */

export interface V2LineItem {
  description: string;
  quantity: number;
  unitCostExGst: number;
  totalExGst: number;
  hasGst: boolean;
  gstAmount: number;
  totalIncGst: number;
  category: string;
  confidence: number;
  notes?: string;
}

export interface V2ExtractedInvoice {
  vendor: {
    name: string;
    abn?: string;
    confidence: number;
  };
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  lineItems: V2LineItem[];
  totals: {
    subtotalExGst: number;
    gstAmount: number;
    totalIncGst: number;
  };
  confidence: number;
  pageCount: number;
  notes?: string;
}

// Categories used at Wild Octave
const CATEGORIES = [
  'Bulk', 'Groceries', 'Supplements', 'Personal Care', 'Naturo',
  'Fruit & Veg', 'Drinks Fridge', 'Fresh Bread', 'Fridge & Freezer', 'House'
] as const;

export class InvoiceParserV2 {
  private anthropic: Anthropic;
  private model: string;

  constructor(model: string = 'claude-sonnet-4-20250514') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
  }

  /**
   * Parse invoice from one or more page images
   */
  async parseInvoice(pageImages: Buffer[], vendorHint?: string): Promise<V2ExtractedInvoice> {
    if (pageImages.length === 0) {
      throw new Error('No page images provided');
    }

    // For single page, simple extraction
    if (pageImages.length === 1) {
      return this.extractFromImages(pageImages, vendorHint);
    }

    // For multi-page, send all pages in one request (better context)
    return this.extractFromImages(pageImages, vendorHint);
  }

  private async extractFromImages(
    images: Buffer[],
    vendorHint?: string
  ): Promise<V2ExtractedInvoice> {
    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: this.buildPrompt(images.length, vendorHint) },
    ];

    // Add all page images
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: img.toString('base64'),
        },
      });
    }

    console.log(`[InvoiceV2] Sending ${images.length} page(s) to ${this.model}...`);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 16384,
      temperature: 0,
      messages: [{ role: 'user', content }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`[InvoiceV2] Response length: ${responseText.length} chars`);

    // Extract JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      console.error('[InvoiceV2] No JSON found in response. First 500 chars:', responseText.substring(0, 500));
      throw new Error('AI did not return structured data. The invoice may be unreadable.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error('[InvoiceV2] JSON parse error:', e);
      throw new Error('AI returned malformed data. Try re-uploading the invoice.');
    }

    // Validate and normalize the response
    return this.normalizeResponse(parsed, images.length);
  }

  private buildPrompt(pageCount: number, vendorHint?: string): string {
    const vendorContext = vendorHint 
      ? `\nThe invoice is likely from: ${vendorHint}. Verify this against what's printed on the document.`
      : '';

    return `Extract all data from this supplier invoice${pageCount > 1 ? ` (${pageCount} pages)` : ''}.${vendorContext}

Return a JSON object with this exact structure:

\`\`\`json
{
  "vendor": {
    "name": "Supplier name as printed on invoice",
    "abn": "ABN if visible, or null",
    "confidence": 0.95
  },
  "invoiceNumber": "INV-12345",
  "invoiceDate": "2025-01-15",
  "lineItems": [
    {
      "description": "Product Name 500g",
      "quantity": 4,
      "unitCostExGst": 18.15,
      "totalExGst": 72.60,
      "hasGst": false,
      "gstAmount": 0,
      "totalIncGst": 72.60,
      "category": "Groceries",
      "confidence": 0.9,
      "notes": null
    }
  ],
  "totals": {
    "subtotalExGst": 620.50,
    "gstAmount": 12.30,
    "totalIncGst": 632.80
  },
  "confidence": 0.92,
  "notes": null
}
\`\`\`

RULES:
1. Extract EVERY line item. Never truncate, summarize, or sample.
2. **quantity** = the QTY/Quantity column value (how many units ordered). NOT pack sizes in descriptions like "(12)" or "x6".
3. **unitCostExGst** = price per single unit excluding GST.
4. **totalExGst** = quantity × unitCostExGst
5. **hasGst** = read from the GST/Tax column. If GST amount > $0 for that row, it's true.
6. **gstAmount** = the GST dollar amount for this line (0 if no GST).
7. **totalIncGst** = totalExGst + gstAmount
8. **invoiceDate** must be YYYY-MM-DD format.
9. **category** must be one of: ${CATEGORIES.join(', ')}
10. Read product names exactly as printed — no guessing or paraphrasing.
11. If text is unclear, include what you can read and set confidence lower.
12. The totals object should match the invoice footer totals.
13. After extraction, verify: sum of all totalExGst ≈ totals.subtotalExGst. If not, you missed items.

This is for an Australian health food store. Products include organic groceries, supplements, personal care, bulk wholefoods, drinks, fresh bread, and produce.`;
  }

  private normalizeResponse(parsed: any, pageCount: number): V2ExtractedInvoice {
    // Normalize line items
    const lineItems: V2LineItem[] = (parsed.lineItems || []).map((item: any) => {
      const quantity = parseFloat(item.quantity) || 1;
      const unitCostExGst = parseFloat(item.unitCostExGst) || 0;
      const totalExGst = parseFloat(item.totalExGst) || (quantity * unitCostExGst);
      const hasGst = Boolean(item.hasGst);
      const gstAmount = parseFloat(item.gstAmount) || (hasGst ? totalExGst * 0.1 : 0);
      const totalIncGst = parseFloat(item.totalIncGst) || (totalExGst + gstAmount);

      // Validate category
      const category = CATEGORIES.includes(item.category) ? item.category : 'Groceries';

      return {
        description: String(item.description || item.itemDescription || '').trim(),
        quantity,
        unitCostExGst: round2(unitCostExGst),
        totalExGst: round2(totalExGst),
        hasGst,
        gstAmount: round2(gstAmount),
        totalIncGst: round2(totalIncGst),
        category,
        confidence: parseFloat(item.confidence) || 0.8,
        notes: item.notes || null,
      };
    });

    // Calculate totals from items if not provided
    const calculatedSubtotal = round2(lineItems.reduce((s, i) => s + i.totalExGst, 0));
    const calculatedGst = round2(lineItems.reduce((s, i) => s + i.gstAmount, 0));

    const totals = {
      subtotalExGst: parseFloat(parsed.totals?.subtotalExGst) || calculatedSubtotal,
      gstAmount: parseFloat(parsed.totals?.gstAmount) || calculatedGst,
      totalIncGst: parseFloat(parsed.totals?.totalIncGst) || (calculatedSubtotal + calculatedGst),
    };

    // Log validation
    const subtotalDiff = Math.abs(calculatedSubtotal - totals.subtotalExGst);
    if (subtotalDiff > 5) {
      console.warn(`[InvoiceV2] ⚠️ Subtotal mismatch: calculated $${calculatedSubtotal} vs invoice $${totals.subtotalExGst} (diff: $${subtotalDiff.toFixed(2)})`);
    } else {
      console.log(`[InvoiceV2] ✅ Totals validated: $${calculatedSubtotal} calculated vs $${totals.subtotalExGst} on invoice`);
    }

    console.log(`[InvoiceV2] Extracted ${lineItems.length} items from ${pageCount} page(s)`);

    return {
      vendor: {
        name: String(parsed.vendor?.name || 'Unknown Vendor').trim(),
        abn: parsed.vendor?.abn || null,
        confidence: parseFloat(parsed.vendor?.confidence) || 0.8,
      },
      invoiceNumber: String(parsed.invoiceNumber || '').trim(),
      invoiceDate: normalizeDate(parsed.invoiceDate),
      lineItems,
      totals: {
        subtotalExGst: round2(totals.subtotalExGst),
        gstAmount: round2(totals.gstAmount),
        totalIncGst: round2(totals.totalIncGst),
      },
      confidence: parseFloat(parsed.confidence) || 0.8,
      pageCount,
      notes: parsed.notes || null,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeDate(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0];
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    return dateStr;
  }

  // DD/MM/YYYY (Australian format)
  const auMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (auMatch) {
    const [, d, m, y] = auMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  console.warn(`[InvoiceV2] Could not parse date: ${dateStr}, using today`);
  return new Date().toISOString().split('T')[0];
}
