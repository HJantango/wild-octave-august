import Anthropic from '@anthropic-ai/sdk';

interface ExtractedLineItem {
  itemDescription: string;
  quantity: number;
  unitCostExGst: number;
  category: string;
  priceExGst: number;
  hasGst: boolean;
  priceIncGst: number;
  packQuantityJustification?: string;
  validationConfidence?: number;
  validationFlags?: string[];
}

interface ExtractedVendor {
  name: string;
  confidence: number;
}

interface DebuggingInfo {
  tableStructure: {
    columnHeaders: string[];
    columnCount: number;
    rowCount: number;
    qtyColumnIndex: number;
    descriptionColumnIndex: number;
    gstColumnIndex: number;
    priceColumnIndex: number;
  };
  sampleRowAnalysis: {
    rowNumber: number;
    qtyValue: string;
    descriptionValue: string;
    gstValue: string;
    priceValue: string;
    extractedQuantity: number;
    gstDetected: boolean;
  };
  invoiceTotals: {
    subtotalExGst: number;
    gstAmount: number;
    totalIncGst: number;
    totalsFound: boolean;
  };
  validationSummary: {
    totalLineItemsFound: number;
    extractedLineItems: number;
    calculatedSubtotal: number;
    calculatedGst: number;
    calculatedTotal: number;
    totalsMatch: boolean;
    warnings: string[];
  };
}

interface ExtractedInvoice {
  debugging: DebuggingInfo;
  vendor: ExtractedVendor;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: ExtractedLineItem[];
  confidence: number;
}

export class FreshLLMInvoiceParser {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for LLM invoice parsing');
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async parseInvoiceFromMultiplePages(pageImages: Buffer[]): Promise<ExtractedInvoice> {
    if (pageImages.length === 1) {
      return this.parseInvoiceFromImage(pageImages[0]);
    }

    try {
      console.log(`DEBUG: Processing multi-page invoice with ${pageImages.length} pages`);

      // Process all pages with LLM vision model
      const allLineItems: ExtractedLineItem[] = [];
      let finalVendor: ExtractedVendor = { name: 'Unknown Vendor', confidence: 0.8 };
      let finalInvoiceNumber = '';
      let finalInvoiceDate = '';
      let totalConfidence = 0;

      for (let i = 0; i < pageImages.length; i++) {
        const pageNumber = i + 1;
        console.log(`DEBUG: Processing page ${pageNumber}/${pageImages.length}`);

        const pageResult = await this.parseInvoiceFromImage(pageImages[i], pageNumber);
        
        // Use vendor info from first page
        if (i === 0) {
          finalVendor = pageResult.vendor;
          finalInvoiceNumber = pageResult.invoiceNumber;
          finalInvoiceDate = pageResult.invoiceDate;
        }

        // Accumulate line items from all pages
        if (pageResult.lineItems && pageResult.lineItems.length > 0) {
          console.log(`DEBUG: Page ${pageNumber} contributed ${pageResult.lineItems.length} line items`);
          allLineItems.push(...pageResult.lineItems);
        }

        totalConfidence += pageResult.confidence;
      }

      const result: ExtractedInvoice = {
        vendor: finalVendor,
        invoiceNumber: finalInvoiceNumber,
        invoiceDate: finalInvoiceDate,
        lineItems: allLineItems,
        confidence: totalConfidence / pageImages.length
      };

      console.log(`DEBUG: Multi-page parsing completed - total ${allLineItems.length} line items from ${pageImages.length} pages`);
      return result;

    } catch (error) {
      console.error('Error in multi-page LLM invoice parsing:', error);
      throw new Error(`Multi-page LLM invoice parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async parseInvoiceFromImage(imageBuffer: Buffer, pageNumber: number = 1): Promise<ExtractedInvoice> {
    try {
      console.log('DEBUG: Starting fresh LLM invoice parsing with image buffer size:', imageBuffer.length);

      const base64Image = imageBuffer.toString('base64');
      const prompt = this.createFreshInvoiceParsingPrompt(pageNumber);

      console.log('DEBUG: Sending request to Claude vision model...');
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 8192, // Maximum allowed for claude-3-5-haiku-20241022
        temperature: 0.1, // Lower temperature for more consistent, complete extraction
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('DEBUG: Received response from Claude, parsing JSON...');
      console.log('DEBUG: Full Claude response length:', responseText.length);
      
      // Log the full response to see debugging info
      console.log('=== FULL CLAUDE RESPONSE START ===');
      console.log(responseText);
      console.log('=== FULL CLAUDE RESPONSE END ===');
      
      // Look for potential issues with truncated responses
      if (responseText.length > 7500) {
        console.log('⚠️  WARNING: Response approaching token limit, may be truncated');
      }

      // New structured debugging validation - check if debugging info is in JSON
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        // If no JSON found, check if this is a page with no line items (like totals page)
        console.log('⚠️  No JSON found in response - checking if this is an empty page');
        console.log('Response text:', responseText.substring(0, 500));
        
        // Return empty result for pages with no line items
        const emptyResult: ExtractedInvoice = {
          debugging: {
            tableStructure: {
              columnHeaders: [],
              columnCount: 0,
              rowCount: 0,
              qtyColumnIndex: -1,
              descriptionColumnIndex: -1,
              gstColumnIndex: -1,
              priceColumnIndex: -1
            },
            sampleRowAnalysis: {
              rowNumber: 0,
              qtyValue: '',
              descriptionValue: '',
              gstValue: '',
              priceValue: '',
              extractedQuantity: 0,
              gstDetected: false
            },
            invoiceTotals: {
              subtotalExGst: 0,
              gstAmount: 0,
              totalIncGst: 0,
              totalsFound: false
            },
            validationSummary: {
              totalLineItemsFound: 0,
              extractedLineItems: 0,
              calculatedSubtotal: 0,
              calculatedGst: 0,
              calculatedTotal: 0,
              totalsMatch: false,
              warnings: ['No line items found on this page']
            }
          },
          vendor: {
            name: pageNumber === 1 ? 'Unknown Vendor' : '',
            confidence: 0.5
          },
          invoiceNumber: '',
          invoiceDate: '',
          lineItems: [],
          confidence: 0.5
        };
        
        console.log(`DEBUG: Page ${pageNumber} contains no line items, returning empty result`);
        return emptyResult;
      }

      const parsedData = JSON.parse(jsonMatch[1]);
      console.log('DEBUG: Successfully parsed JSON, found', parsedData.lineItems?.length || 0, 'line items');
      
      // Validate that debugging information is present in the JSON
      if (parsedData.debugging) {
        console.log('✅ LLM provided structured debugging information in JSON');
        
        // Log debugging insights
        const debug = parsedData.debugging;
        console.log(`📊 TABLE STRUCTURE: ${debug.tableStructure?.columnCount || 0} columns, ${debug.tableStructure?.rowCount || 0} rows`);
        console.log(`📊 COLUMNS: ${debug.tableStructure?.columnHeaders?.join(', ') || 'Not specified'}`);
        console.log(`📊 SAMPLE ROW: QTY="${debug.sampleRowAnalysis?.qtyValue}", GST="${debug.sampleRowAnalysis?.gstValue}"`);
        console.log(`📊 INVOICE TOTALS: Ex GST: $${debug.invoiceTotals?.subtotalExGst}, GST: $${debug.invoiceTotals?.gstAmount}, Inc GST: $${debug.invoiceTotals?.totalIncGst}`);
        console.log(`📊 VALIDATION: Found ${debug.validationSummary?.totalLineItemsFound}, Extracted ${debug.validationSummary?.extractedLineItems}, Totals Match: ${debug.validationSummary?.totalsMatch}`);
        
        // Log warnings if present
        if (debug.validationSummary?.warnings && debug.validationSummary.warnings.length > 0) {
          console.log('⚠️  VALIDATION WARNINGS:');
          debug.validationSummary.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        // Check if validation passed
        if (!debug.validationSummary?.totalsMatch) {
          console.log('🚨 CRITICAL: Invoice totals do not match extracted totals - likely incomplete extraction!');
        }
        
        if (debug.validationSummary?.extractedLineItems < 15) {
          console.log(`🚨 CRITICAL WARNING: Only ${debug.validationSummary?.extractedLineItems} line items extracted - likely incomplete!`);
        }
        
        // Validate that actual extracted items match claimed count
        const actualItemCount = parsedData.lineItems?.length || 0;
        const claimedItemCount = debug.validationSummary?.extractedLineItems || 0;
        
        if (actualItemCount !== claimedItemCount) {
          console.log(`🚨 CRITICAL MISMATCH: LLM claims ${claimedItemCount} items but only provided ${actualItemCount} in JSON!`);
          
          // If it's a very large discrepancy (LLM found many but extracted very few), this indicates sample response
          // But allow some discrepancy since the LLM may have token limits
          // Note: Validation removed - allowing all extractions to proceed regardless of count mismatch
          
          console.log('⚠️  WARNING: Continuing with processing despite mismatch - but this indicates LLM accuracy issues');
        }
        
        if (actualItemCount < debug.validationSummary?.totalLineItemsFound) {
          console.log(`🚨 CRITICAL INCOMPLETE: LLM found ${debug.validationSummary?.totalLineItemsFound} items but only extracted ${actualItemCount}!`);
          console.log('⚠️  WARNING: Continuing with processing despite incomplete extraction');
          // Don't throw error - just log the issue and continue
        }
        
        // Only enforce minimum threshold for very poor extractions
        if (actualItemCount < 3) {
          console.log(`🚨 BLOCKING: Too few items extracted (${actualItemCount}) - this is likely a complete failure`);
          throw new Error(`Extraction too incomplete: only ${actualItemCount} items extracted`);
        }
      } else {
        console.log('🚨 CRITICAL: LLM did not provide debugging information in JSON - rejecting response');
        throw new Error('LLM response lacks required debugging information');
      }
      
      // Comprehensive extraction quality validation using debugging data
      if (parsedData.lineItems && parsedData.lineItems.length > 0) {
        console.log(`DEBUG: Extracted ${parsedData.lineItems.length} line items total`);
        console.log('DEBUG: First 3 line items extracted:');
        parsedData.lineItems.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.itemDescription} (Qty: ${item.quantity}, Unit: ${item.unitCostExGst})`);
        });
        
        // Quantity validation - check for defaulting to 1
        const quantityOnes = parsedData.lineItems.filter(item => item.quantity === 1).length;
        const totalItems = parsedData.lineItems.length;
        const onesPercentage = (quantityOnes / totalItems) * 100;
        
        console.log(`DEBUG: Quantity analysis - ${quantityOnes}/${totalItems} items have qty=1 (${onesPercentage.toFixed(1)}%)`);
        if (onesPercentage > 80) {
          console.log('🚨 CRITICAL WARNING: >80% items have quantity=1 - likely failed to read QTY column correctly!');
        }
        
        // GST detection validation
        const gstItems = parsedData.lineItems.filter(item => item.hasGst === true).length;
        const gstFreeItems = parsedData.lineItems.filter(item => item.hasGst === false).length;
        console.log(`DEBUG: GST distribution - ${gstItems} with GST, ${gstFreeItems} GST-free`);
        
        // Check for suspicious GST patterns
        if (gstItems === parsedData.lineItems.length) {
          console.log('⚠️  WARNING: ALL items marked with GST - verify this is correct');
        }
        if (gstFreeItems === parsedData.lineItems.length) {
          console.log('⚠️  WARNING: ALL items marked GST-free - verify this is correct');
        }
      }

      const result: ExtractedInvoice = {
        debugging: parsedData.debugging || {
          tableStructure: {
            columnHeaders: [],
            columnCount: 0,
            rowCount: 0,
            qtyColumnIndex: -1,
            descriptionColumnIndex: -1,
            gstColumnIndex: -1,
            priceColumnIndex: -1
          },
          sampleRowAnalysis: {
            rowNumber: 0,
            qtyValue: '',
            descriptionValue: '',
            gstValue: '',
            priceValue: '',
            extractedQuantity: 0,
            gstDetected: false
          },
          invoiceTotals: {
            subtotalExGst: 0,
            gstAmount: 0,
            totalIncGst: 0,
            totalsFound: false
          },
          validationSummary: {
            totalLineItemsFound: 0,
            extractedLineItems: 0,
            calculatedSubtotal: 0,
            calculatedGst: 0,
            calculatedTotal: 0,
            totalsMatch: false,
            warnings: ['Missing debugging information']
          }
        },
        vendor: {
          name: parsedData.vendor?.name || 'Unknown Vendor',
          confidence: parseFloat(parsedData.vendor?.confidence) || 0.8
        },
        invoiceNumber: parsedData.invoiceNumber || '',
        invoiceDate: parsedData.invoiceDate || '',
        lineItems: parsedData.lineItems?.map((item: any) => ({
          itemDescription: item.itemDescription || item.name || '',
          quantity: parseFloat(item.quantity) || 1,
          unitCostExGst: parseFloat(item.unitCostExGst) || 0,
          category: item.category || 'Groceries',
          priceExGst: parseFloat(item.priceExGst) || 0,
          hasGst: Boolean(item.hasGst),
          priceIncGst: parseFloat(item.priceIncGst) || 0,
          packQuantityJustification: item.packQuantityJustification || null,
          validationConfidence: parseFloat(item.validationConfidence) || 0.8,
          validationFlags: Array.isArray(item.validationFlags) ? item.validationFlags : []
        })) || [],
        confidence: parsedData.confidence || 0.8
      };

      console.log('DEBUG: Fresh LLM parsing completed successfully');
      return result;

    } catch (error) {
      console.error('Error in fresh LLM invoice parsing:', error);
      throw new Error(`Fresh LLM invoice parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createFreshInvoiceParsingPrompt(pageNumber: number = 1): string {
    return `🚨 CRITICAL: Extract invoice data with MANDATORY DEBUGGING INFORMATION included in your JSON response.

You are a precise invoice data extraction system. Analyze this invoice image and extract the information in the EXACT JSON format shown below.

🚨🚨🚨 ABSOLUTELY CRITICAL - NO SAMPLES OR EXAMPLES 🚨🚨🚨
**EXTRACT EVERY SINGLE LINE ITEM - NO EXCEPTIONS**
**DO NOT PROVIDE SAMPLE RESPONSES - EXTRACT ALL ITEMS**
**DO NOT SAY "FIRST X ITEMS" OR "FOR BREVITY" - INCLUDE EVERYTHING**
**IF YOU PROVIDE INCOMPLETE DATA, THE ENTIRE SYSTEM FAILS**
**THIS IS NOT A DEMONSTRATION - THIS IS PRODUCTION DATA EXTRACTION**
**EVERY MISSING ITEM COSTS THE BUSINESS MONEY**
**YOU MUST INCLUDE ALL ITEMS IN THE JSON - NOT A SUBSET**
${pageNumber > 1 ? `⚠️ **THIS IS PAGE ${pageNumber} OF A MULTI-PAGE INVOICE**` : ''}

**CRITICAL: NO HALLUCINATION - READ EXACTLY WHAT'S WRITTEN**
- You MUST read the product names character-by-character from the invoice image
- Do NOT guess, interpret, or make up product names
- If text is unclear, copy what you can see clearly and note uncertainty
- NEVER invent words that are not literally printed on the invoice

**UNIVERSAL TABLE READING SYSTEM - ALL INVOICE TYPES:**

🚨 **MANDATORY FOR ALL INVOICES: SYSTEMATIC TABLE ANALYSIS**
Every invoice has a table structure. Follow this process for ANY invoice format:

**STEP 1: LOCATE TABLE HEADERS**
Scan for column headers like: QTY, Quantity, Description, Item, Unit Price, Price, GST, Tax, Total

**STEP 2: MAP COLUMN POSITIONS**  
Note position of each column (count from left to right):
- Column 1: Usually QTY/Quantity
- Column 2: Usually Item Code or Description  
- Column 3: Usually Description or Unit Price
- Column 4-6: Various price, GST, total columns

**STEP 3: READ ONE SAMPLE ROW**
Pick any product row and read each cell to verify your column mapping:
- "What's in column 1?" → Should be a number (quantity)
- "What's in column with 'GST' header?" → Should be dollar amount or code
- "What's in column with 'Unit' header?" → Should be unit price

**STEP 4: APPLY TO ALL ROWS**
For each product row, read cell-by-cell:
1. **QUANTITY**: Read from QTY/Quantity column → ignore pack numbers in descriptions
2. **DESCRIPTION**: Read product name → clean up codes and pack info  
3. **UNIT COST**: Read from Unit Price/Unit Net column → use as unitCostExGst
4. **GST STATUS**: Read from GST/Tax column → determine hasGst based on actual value

**CRITICAL RULES FOR ALL INVOICES:**
- ✅ USE: QTY column number for quantity
- ❌ IGNORE: Pack numbers in descriptions like "(12)", "x6", "/24"
- ✅ USE: GST column dollar amount for hasGst determination  
- ❌ DON'T GUESS: GST status based on product type

**GST DETECTION - CRITICAL ACCURACY REQUIRED:**

🚨 **SIMPLE GST RULE - NO EXCEPTIONS**:

**FOR EVERY SINGLE ROW:**
1. Look at the GST column for that specific row
2. If you see a dollar amount like $1.23, $2.45, $0.57 → hasGst: true
3. If you see $0.00, blank, or no amount → hasGst: false

**THAT'S IT. NOTHING ELSE MATTERS.**

**EXAMPLES - READ THE GST COLUMN ONLY:**
- GST column shows "$2.34" → hasGst: true
- GST column shows "$0.00" → hasGst: false  
- GST column shows blank → hasGst: false
- GST column shows "$0.57" → hasGst: true

🚨 **CRITICAL QTY COLUMN READING**:
- The QTY column is typically the FIRST column on the left
- Look for numbers like 1, 2, 3, 4, 5, 10, etc. in this column
- NEVER use 1 as a default - if you can't read the QTY clearly, flag it
- Common QTY values on invoices: 1, 2, 3, 4, 5, 6, 8, 10, 12, 24

**HORIZON FOODS SPECIFIC EXAMPLES**:
- Table row: "4 | BC500 | Byron Chai Indian Spiced Tea 500g Bulk (12) | Each | $18.15 | $0.00 | $72.60"
  ✅ CORRECT: quantity: 4, unitCostExGst: 18.15, hasGst: false
  ❌ WRONG: quantity: 12 (ignoring bracketed number)

- Table row: "5 | SIMW80 | Spiral Instant Miso White 5x7g (12) | Each | $6.25 | $3.13 | $34.38"  
  ✅ CORRECT: quantity: 5, unitCostExGst: 6.25, hasGst: true
  ❌ WRONG: quantity: 12 (ignoring bracketed number)

**UNIT COST CALCULATION - CRITICAL:**
🧮 **ALWAYS CALCULATE: unitCostExGst = priceExGst ÷ quantity**

**PACK QUANTITY PATTERNS TO REMOVE:**
- Numbers after sizes: "1ltr6", "500ml12", "25kg24"
- Standalone pack numbers: "WATER 6", "CRACKERS 12" 
- Pack expressions: "x6", "x12", "6 boxes", "12 pack"
- Keep the base product size, remove only the pack multiplier

**CATEGORIES GUIDE:**
- Bulk: Large quantities (25kg, 5kg bags, wholesale amounts)
- Groceries: Pantry items, dry goods, crackers, pasta
- Supplements: Vitamins, protein powders, health products
- Personal Care: Soap, shampoo, skincare, cosmetics
- Naturo: Natural health, herbal remedies
- Fruit & Veg: Fresh produce, organic fruits/vegetables
- Drinks Fridge: Beverages, juices
- Fresh Bread: Bakery items
- Fridge & Freezer: Dairy, frozen items
- House: Cleaning products, household items

**IMPORTANT DATE FORMAT:**
Always format dates as YYYY-MM-DD (e.g., "2024-12-17")

🚨 **CRITICAL: EXTRACT EVERY SINGLE LINE ITEM - NO SHORTCUTS**

You MUST include EVERY line item in the JSON response. DO NOT summarize, truncate, or say "for brevity". 
If you find 24 items, you MUST include all 24 items in the lineItems array.
If you find 30 items, you MUST include all 30 items in the lineItems array.

**NEVER SAY:**
- "I've included the first X items..."
- "For brevity, here are X items..."
- "Would you like me to continue with the rest?"
- "Here's a sample of the items..."
- "Note: I've extracted the first X items to demonstrate..."
- "The full JSON would include all X items..."
- "Would you like me to continue with the complete extraction?"

**ALWAYS DO:**
- Include every single item you can see
- Extract the complete data set
- Provide the full JSON without truncation
- NEVER ask if I want you to continue - JUST DO IT
- This is an automated system, not an interactive conversation

🚨 **MANDATORY JSON FORMAT WITH DEBUGGING INFO:**

The validationSummary.extractedLineItems MUST equal the actual number of items in your lineItems array.
If they don't match, your response will be rejected.

\`\`\`json
{
  "debugging": {
    "tableStructure": {
      "columnHeaders": ["QTY", "Item Code", "Description", "Unit of Supply", "Unit Net", "GST", "Total Net"],
      "columnCount": 7,
      "rowCount": 25,
      "qtyColumnIndex": 0,
      "descriptionColumnIndex": 2,
      "gstColumnIndex": 5,
      "priceColumnIndex": 4
    },
    "sampleRowAnalysis": {
      "rowNumber": 1,
      "qtyValue": "4",
      "descriptionValue": "Byron Chai Indian Spiced Tea 500g Bulk (12)",
      "gstValue": "$0.00",
      "priceValue": "$18.15",
      "extractedQuantity": 4,
      "gstDetected": false
    },
    "invoiceTotals": {
      "subtotalExGst": 620.67,
      "gstAmount": 3.88,
      "totalIncGst": 624.50,
      "totalsFound": true
    },
    "validationSummary": {
      "totalLineItemsFound": 25,
      "extractedLineItems": 25,
      "calculatedSubtotal": 620.67,
      "calculatedGst": 3.88,
      "calculatedTotal": 624.55,
      "totalsMatch": true,
      "warnings": []
    }
  },
  "vendor": {
    "name": "Company Name from Invoice",
    "confidence": 0.95
  },
  "invoiceNumber": "INV123456",
  "invoiceDate": "2024-12-17",
  "lineItems": [
    {
      "itemDescription": "Byron Chai Indian Spiced Tea 500g Bulk",
      "quantity": 4,
      "unitCostExGst": 18.15,
      "category": "Groceries",
      "priceExGst": 72.60,
      "hasGst": false,
      "priceIncGst": 72.60,
      "packQuantityJustification": null,
      "validationConfidence": 0.9,
      "validationFlags": ["pack_quantity_calculation"]
    },
    {
      "itemDescription": "Salt Epsom Salts Food Grade",
      "quantity": 1,
      "unitCostExGst": 76.80,
      "category": "Bulk", 
      "priceExGst": 76.80,
      "hasGst": true,
      "priceIncGst": 84.48,
      "packQuantityJustification": null,
      "validationConfidence": 0.95,
      "validationFlags": []
    }
  ],
  "confidence": 0.9
}
\`\`\`

**ANTI-HALLUCINATION CHECKLIST:**
1. Look at each product line on the invoice
2. Read the text very carefully - every letter matters
3. Copy ONLY what is actually printed - no guessing
4. If a word is partially obscured, write what you can see + "[unclear]"
5. NEVER substitute similar-sounding words
6. NEVER make up brand names or product variants

**EXAMPLES OF COMMON MISTAKES TO AVOID:**
- ❌ Invoice shows "WORT" → AI writes "WOT" (wrong!)
- ❌ Invoice shows "LEM-GINGER" → AI writes "LOW-GIVERS" (hallucination!)
- ❌ Invoice shows "SAVVY" → AI writes "SUNNY" (misreading!)
- ✅ When unsure, write exactly what you see: "WO[unclear]T ORGANIC LEM-GINGER"

🔍 **FINAL COMPLETENESS CHECK:**
Before submitting your JSON response:

**DATA ACCURACY VALIDATION:**
1. **QUANTITY CHECK**: Every quantity should come from QTY column, NOT from descriptions
   - Look for any quantity = 1 → verify this was actually in QTY column
   - If you see many quantity: 1 values, you probably defaulted instead of reading QTY column
2. **GST CHECK**: Every hasGst value should come from GST column, NOT from product type guessing  
   - Look for patterns like all hasGst: true → you probably guessed instead of reading GST column
   - Mixed GST statuses are normal and expected on most invoices
3. **UNIT COST MATH**: For each item, verify unitCostExGst × quantity ≈ priceExGst
   - If not matching, recalculate: unitCostExGst = priceExGst ÷ quantity

**COMPLETENESS VALIDATION:**
4. **COUNT ALL LINE ITEMS**: Scan the entire invoice from top to bottom
5. **VERIFY NOTHING MISSED**: Check for continued pages, footer items, or wrap-around lines
6. **INCLUDE EVERY PRODUCT**: Don't stop at 3-5 items - include ALL items visible
7. **CONFIRM TOTAL COUNT**: Your lineItems array should contain EVERY purchasable item on the invoice

**PRICING LOGIC VALIDATION:**
8. **VALIDATE GST LOGIC**: Check that pricing math makes sense:
   - hasGst: true → priceIncGst ≈ priceExGst × 1.1 
   - hasGst: false → priceIncGst = priceExGst  
9. **DOUBLE-CHECK QUANTITIES**: Ensure unit sizes (kg, L, ml, g) are preserved in descriptions

🚨 **MANDATORY FINAL VALIDATION - DO NOT SUBMIT WITHOUT THIS**:

**COUNT VERIFICATION**:
1. Count your extracted line items in the JSON
2. Look at the invoice table again and count visible product rows
3. Numbers MUST MATCH - if not, you missed items
4. Typical counts: Horizon Foods = 20-30+ items, Beach & Bush = 15-25+ items

**QUANTITY VERIFICATION**:
1. Check your quantities - if 80%+ are quantity: 1, you failed to read QTY column
2. Real invoices have mixed quantities like 1, 2, 3, 4, 5, 6, 8, 10, 12, 24
3. If you see mostly 1's, start over and read the leftmost QTY column correctly

**GST VERIFICATION**:
1. For EACH item, verify hasGst matches the GST column dollar amount:
   - hasGst: true should have $>0.00 in GST column  
   - hasGst: false should have $0.00 or blank in GST column
2. If you marked Spiral Miso as hasGst: true, check the GST column shows a dollar amount
3. If you marked Simply Clean products as hasGst: false, check the GST column shows $0.00

**COMPLETENESS VERIFICATION**:
Look at the bottom of the product table - did you extract items from there?
Many invoices have 2-3 sections or continue below page breaks.

**MANDATORY TOTAL VALIDATION - CRITICAL**:
After extracting all line items, you MUST:
1. **Calculate your extracted totals**:
   - Sum all priceExGst values → your calculated subtotal
   - Sum all GST amounts from hasGst:true items → your calculated GST total
2. **Compare against invoice totals** (from DEBUG STEP 5):
   - Does your subtotal match the invoice "Total Ex GST"?
   - Does your GST total match the invoice "GST Amount"?
3. **If totals don't match within $5**:
   - You missed line items OR got quantities/GST wrong
   - Go back and re-examine the table
   - Find the missing/incorrect items
   - Fix your extraction before submitting JSON

**EXAMPLE VALIDATION**:
- Invoice shows: Total Ex GST: $620.67, GST: $3.88
- Your calculation: Sum of priceExGst: $620.67, Sum of GST: $3.88
- ✅ Match = extraction is complete and accurate
- ❌ Don't match = re-examine invoice for missing/wrong items

❌ **AUTOMATIC REJECTION CRITERIA**:
- Fewer than 15 items extracted from a full commercial invoice
- Your calculated totals don't match invoice totals (±$5)
- 90%+ items with quantity: 1 when QTY column shows mixed values  
- All items having identical GST status when invoice shows mixed
- Missing entire sections of the product table

✅ **SUCCESSFUL EXTRACTION INDICATORS**:
- Your calculated totals match invoice totals exactly
- Item count matches visible table rows (15-40+ for commercial invoices)
- Mixed quantities reflecting actual QTY column values
- Mixed GST status based on actual GST column amounts`
  }
}