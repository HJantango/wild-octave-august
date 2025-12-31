import { Anthropic } from '@anthropic-ai/sdk';

// Define the structured output schema
export interface LLMExtractedLineItem {
  name: string;
  quantity: number;
  unitCostExGst: number;
  detectedPackSize?: number;
  effectiveUnitCostExGst: number;
  category: string;
  confidence: number;
  gstRate?: number;
  gstAmount?: number;
  hasGst?: boolean;
}

export interface LLMExtractedVendor {
  name: string;
  confidence: number;
}

export interface LLMExtractedInvoice {
  vendor: LLMExtractedVendor;
  invoiceNumber?: string;
  invoiceDate: Date;
  lineItems: LLMExtractedLineItem[];
  confidence: number;
  rawText?: string;
}

export class LLMInvoiceParser {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Parse invoice using Claude's vision model
   */
  async parseInvoiceFromImage(imageBuffer: Buffer): Promise<LLMExtractedInvoice> {
    try {
      console.log('DEBUG: Starting LLM invoice parsing with image buffer size:', imageBuffer.length);
      
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = this.createInvoiceParsingPrompt();
      
      console.log('DEBUG: Sending request to Claude vision model...');
      
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: base64Image
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      });

      console.log('DEBUG: Received response from Claude, parsing JSON...');
      
      // Extract the JSON from the response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('DEBUG: Claude response preview:', responseText.substring(0, 500) + '...');
      
      // Find JSON in the response (it should be wrapped in ```json blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const jsonString = jsonMatch[1];
      const parsedData = JSON.parse(jsonString);
      
      console.log('DEBUG: Successfully parsed JSON, found', parsedData.lineItems?.length || 0, 'line items');
      
      // Convert to our expected format
      const result: LLMExtractedInvoice = {
        vendor: {
          name: parsedData.vendor?.name || 'Unknown Vendor',
          confidence: parsedData.vendor?.confidence || 0.5
        },
        invoiceNumber: parsedData.invoiceNumber,
        invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate) : new Date(),
        lineItems: parsedData.lineItems?.map((item: any) => {
          const quantity = parseFloat(item.quantity) || 1;
          const unitCostExGst = parseFloat(item.unitCostExGst) || 0;
          const detectedPackSize = item.detectedPackSize ? parseFloat(item.detectedPackSize) : undefined;
          
          // Calculate effective unit cost - if there's a pack size, use the unit cost as is
          // If no pack size, the unit cost should already be per individual unit
          const effectiveUnitCostExGst = detectedPackSize && detectedPackSize > 1 
            ? unitCostExGst / detectedPackSize  // Divide by pack size to get per-unit cost
            : unitCostExGst;
            
          return {
            name: item.name || 'Unknown Item',
            quantity,
            unitCostExGst,
            detectedPackSize,
            effectiveUnitCostExGst,
            category: item.category || 'Groceries',
            confidence: parseFloat(item.confidence) || 0.8,
            gstRate: item.gstRate ? parseFloat(item.gstRate) : (item.hasGst !== false ? 10 : 0),
            gstAmount: item.gstAmount ? parseFloat(item.gstAmount) : undefined,
            hasGst: item.hasGst !== false
          };
        }) || [],
        confidence: parsedData.confidence || 0.8,
        rawText: responseText
      };

      console.log('DEBUG: LLM parsing completed successfully');
      return result;

    } catch (error) {
      console.error('Error in LLM invoice parsing:', error);
      throw new Error(`LLM invoice parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createInvoiceParsingPrompt(): string {
    return `You are an expert invoice processing system. Analyze this invoice image and extract all the information in the exact JSON format specified below.

**MOST CRITICAL: COMPLETE PRODUCT NAME EXTRACTION**
- Extract EVERY SINGLE WORD from each product description
- Never abbreviate, truncate, or skip any words
- Include ALL descriptive words like "Toasted", "Rolled", "Raw", "Organic", etc.
- Example: If you see "MUESLI TOASTED 10KG", extract "Muesli Toasted 10kg" (all words)

**CRITICAL INSTRUCTIONS:**
1. Extract ALL line items from the invoice - do not miss any products
2. For quantity, use the TOTAL quantity. Examples:
   - "2 x 5kg" → quantity should be 2 (the number of units), detectedPackSize should be 5
   - "6 pack" → quantity should be 6, detectedPackSize should be 1 
   - "3 boxes of 10" → quantity should be 3, detectedPackSize should be 10
3. For unitCostExGst, extract the per-unit price from the invoice (usually in the "Unit Price" column). DO NOT use the line total. Examples:
   - If invoice shows "Qty: 2, Unit Price: $25.00, Total: $50.00" → unitCostExGst should be 25.00
   - If invoice shows "3 x $15.00 = $45.00" → unitCostExGst should be 15.00
4. For category, choose from: House, Bulk, Fruit & Veg, Fridge & Freezer, Naturo, Groceries, Drinks Fridge, Supplements, Personal Care, Fresh Bread
5. Set hasGst to true if the item is taxable, false if GST-free/tax-free
6. ALWAYS remove product/item codes from the beginning of product names:
   - "BOK-CCGF-001 Cheesecake" → "Cheesecake"
   - "WEL-123 Hand Cream" → "Hand Cream"  
   - "ABC-456-XYZ Organic Apples" → "Organic Apples"

**PRODUCT NAMING CONVENTION (VERY IMPORTANT):**
- Extract the COMPLETE product description from the Item Description column
- Use the FULL product name including all descriptive words
- Include size/weight in the product name when present on the invoice
- Do NOT truncate or abbreviate product names
- Do NOT add brand names unless explicitly shown in the product description

**Examples for different invoice types:**
Trump's invoices:
  - "Muesli Toasted 10kg" (full name from "MUESLI TOASTED 10KG")
  - "Oats Rolled Organic 25kg" (full name from "OATS ROLLED ORGANIC 25KG")
  - "Buckwheat Raw Organic 10kg" (full name from "BUCKWHEAT RAW ORGANIC 10KG")

Other wholesale invoices:
  - "Coconut Oil Virgin 500ml" (if that's the complete description)
  - "Protein Powder Vanilla 1kg" (if brand is not specified)
  
**CRITICAL:** Always extract the complete product name - never just partial words like "Organic" or "10kg"

**READING INVOICE LINE ITEMS (CRITICAL STEPS):**
1. Look at each row in the product table carefully
2. Find the Item Description or Product Name column (usually after the Item Code)
3. Read EVERY SINGLE WORD in that column for each product
4. Copy the complete description word-for-word - never abbreviate, truncate, or skip words
5. Include ALL adjectives, descriptors, and specifications (like "Toasted", "Rolled", "Organic", etc.)

**COMMON MISTAKES TO AVOID:**
- ❌ "Muesli" instead of "Muesli Toasted"  
- ❌ "Oats Organic" instead of "Oats Rolled Organic"
- ❌ "Buckwheat" instead of "Buckwheat Raw Organic"
- ✅ Always include ALL words from the description

**BRAND EXTRACTION:**
- Only include brand names if they are part of the product description itself
- The vendor name (e.g., "Trumps Pty Ltd", "Little Valley") is NOT the product brand
- Many wholesale invoices don't specify individual product brands
- If no brand is mentioned in the product description, leave it out entirely

**CATEGORIES GUIDE:**
- Supplements: vitamins, minerals, protein powders, health supplements
- Personal Care: soap, shampoo, cosmetics, hygiene products  
- Fruit & Veg: fresh produce, organic fruits and vegetables
- Fridge & Freezer: dairy, frozen items, refrigerated products
- Drinks Fridge: beverages, juices, kombucha
- Fresh Bread: bakery items, bread, baked goods
- Bulk: wholesale quantities, 25kg bags, bulk items
- Groceries: general food items, pantry staples
- House: household items, cleaning products
- Naturo: natural health products, herbal remedies

Return your response in this EXACT JSON format:

\`\`\`json
{
  "vendor": {
    "name": "Vendor Company Name",
    "confidence": 0.9
  },
  "invoiceNumber": "INV12345",
  "invoiceDate": "2025-01-15",
  "lineItems": [
    {
      "name": "Muesli Toasted 10kg",
      "quantity": 1,
      "unitCostExGst": 72.50,
      "detectedPackSize": 10,
      "effectiveUnitCostExGst": 72.50,
      "category": "Groceries",
      "confidence": 0.9,
      "gstRate": 10,
      "gstAmount": 7.25,
      "hasGst": true
    },
    {
      "name": "Oats Rolled Organic 25kg",
      "quantity": 1,
      "unitCostExGst": 132.50,
      "detectedPackSize": 25,
      "effectiveUnitCostExGst": 132.50,
      "category": "Bulk",
      "confidence": 0.9,
      "gstRate": 10,
      "gstAmount": 6.00,
      "hasGst": true
    }
  ],
  "confidence": 0.85
}
\`\`\`

Analyze the invoice image now and return the structured data with proper product naming including brands.`;
  }
}

export default LLMInvoiceParser;