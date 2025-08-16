import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  console.log('🚀 POST REQUEST RECEIVED - Processing invoice...')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    console.log('📁 File received:', file.name, 'Type:', file.type, 'Size:', file.size)
    console.log('🔑 API Key present:', !!process.env.ABACUSAI_API_KEY)

    // Convert PDF to base64
    const base64Buffer = await file.arrayBuffer()
    const base64String = Buffer.from(base64Buffer).toString('base64')
    console.log('📄 PDF converted to base64, length:', base64String.length)

    const messages = [{
      role: "user" as const,
      content: [
        {
          type: "file" as const,
          file: {
            filename: file.name,
            file_data: `data:application/pdf;base64,${base64String}`
          }
        },
        {
          type: "text" as const,
          text: `Please extract and parse this health food shop invoice. I need you to:

1. Extract the vendor/supplier name
2. Extract all line items with the following information:
   - Product name (cleaned up)
   - Quantity
   - Unit price (excluding GST)
   - GST status (whether GST applies to this item)
   
3. For unit price calculation, handle these scenarios:
   - Direct unit prices: "BLUEBERRY 125G PUNNET 5.70" → extract unit price 5.70
   - Bulk calculations: "ORANGE VALENCIA 15KG CARTON 63.00/CTN" → calculate per kg: 63.00 ÷ 15 = 4.20
   - Items needing clarification: "APPLE GALA 3 LAYER CARTON 79.00/CTN" → mark as needs clarification

4. For GST determination, use these health food store guidelines:
   - GST-FREE items: Fresh fruits, vegetables, basic unprocessed foods, milk, bread, eggs, meat, fish, some basic supplements
   - GST-APPLICABLE items: Processed foods, confectionery, soft drinks, cosmetics, personal care items, most packaged goods, prepared meals
   - When in doubt, default to GST-APPLICABLE (true)

5. Return the data in this exact JSON format:
{
  "vendor_name": "Vendor Name",
  "line_items": [
    {
      "product_name": "Product Name",
      "quantity": 5.0,
      "unit_price": 5.70,
      "total_price": 28.50,
      "gst_applicable": true,
      "needs_clarification": false,
      "clarification_note": null
    }
  ]
}

Make sure to clean up product names (remove extra spaces, codes) and calculate accurate unit prices. If you cannot determine the unit price clearly, set needs_clarification to true and add a clarification_note explaining what needs to be clarified.

Respond with raw JSON only.`
        }
      ]
    }]

    console.log('🤖 Sending request to AbacusAI API...')

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        max_tokens: 3000,
        response_format: { type: "json_object" }
      }),
    })

    console.log('📡 API Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error response:', errorText)
      throw new Error(`AbacusAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ API Response received successfully')

    let invoiceData
    try {
      const content = result.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in API response')
      }
      
      invoiceData = JSON.parse(content)
      console.log('📊 Parsed invoice data:', {
        vendor: invoiceData.vendor_name,
        itemCount: invoiceData.line_items?.length || 0
      })
    } catch (parseError) {
      console.error('❌ Error parsing API response:', parseError)
      throw new Error('Failed to parse invoice data from API response')
    }

    // Validate the parsed data structure
    if (!invoiceData.vendor_name || !Array.isArray(invoiceData.line_items)) {
      throw new Error('Invalid invoice data structure from API')
    }

    // Save to database
    console.log('💾 Saving to database...')
    await saveInvoiceToDatabase(invoiceData, file.name)
    console.log('✅ Successfully saved to database')

    return NextResponse.json({
      success: true,
      data: invoiceData,
      message: 'Invoice processed successfully!'
    })

  } catch (error) {
    console.error('❌ Error processing invoice:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process invoice',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Invoice processing API is ready',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.ABACUSAI_API_KEY
  })
}

async function saveInvoiceToDatabase(invoiceData: any, filename: string) {
  try {
    // Create or find vendor
    const vendor = await db.vendor.upsert({
      where: { name: invoiceData.vendor_name },
      update: {},
      create: { name: invoiceData.vendor_name }
    })

    // Create invoice
    const invoice = await db.invoice.create({
      data: {
        vendorId: vendor.id,
        filename: filename,
        totalAmount: invoiceData.line_items?.reduce((sum: number, item: any) => 
          sum + (item.total_price || 0), 0) || 0
      }
    })

    // Create line items
    for (const item of invoiceData.line_items || []) {
      // Create or find product
      let product = null
      if (item.product_name) {
        product = await db.product.upsert({
          where: { name: item.product_name },
          update: {},
          create: { 
            name: item.product_name,
            description: item.product_name
          }
        })
      }

      const quantity = item.quantity || 0
      const unitPrice = item.unit_price || 0
      const totalPrice = item.total_price || (quantity * unitPrice)
      const gstApplicable = item.gst_applicable !== undefined ? item.gst_applicable : true
      
      const finalPrice = totalPrice
      const gstAmount = gstApplicable ? finalPrice * 0.1 : 0
      const finalPriceIncGst = finalPrice + gstAmount

      await db.lineItem.create({
        data: {
          invoiceId: invoice.id,
          productId: product?.id,
          productName: item.product_name || 'Unknown Product',
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          gstApplicable: gstApplicable,
          needsClarification: item.needs_clarification || false,
          clarificationNote: item.clarification_note,
          finalPrice: finalPrice,
          gstAmount: gstAmount,
          finalPriceIncGst: finalPriceIncGst,
          categoryId: null,
          customMarkup: null,
          manualUnitPrice: null
        }
      })
    }

    return invoice
  } catch (error) {
    console.error('Error saving to database:', error)
    throw error
  }
}
