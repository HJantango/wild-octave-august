
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = "force-dynamic"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    // Convert PDF to base64 for LLM processing
    const base64Buffer = await file.arrayBuffer()
    const base64String = Buffer.from(base64Buffer).toString('base64')

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

    // Call LLM API with streaming
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        stream: true,
        max_tokens: 3000,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`)
    }

    const encoder = new TextEncoder()
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  // Process the complete JSON response
                  try {
                    // Clean up the buffer and attempt to parse JSON
                    let cleanedBuffer = buffer.trim()
                    
                    // Remove any trailing commas or incomplete JSON
                    cleanedBuffer = cleanedBuffer.replace(/,\s*$/, '')
                    
                    // Try to fix incomplete JSON by adding missing closing brackets
                    if (!cleanedBuffer.endsWith('}')) {
                      // Count opening and closing braces to determine what's missing
                      const openBraces = (cleanedBuffer.match(/\{/g) || []).length
                      const closeBraces = (cleanedBuffer.match(/\}/g) || []).length
                      const openBrackets = (cleanedBuffer.match(/\[/g) || []).length
                      const closeBrackets = (cleanedBuffer.match(/\]/g) || []).length
                      
                      // Add missing closing brackets and braces
                      for (let i = 0; i < (openBrackets - closeBrackets); i++) {
                        cleanedBuffer += ']'
                      }
                      for (let i = 0; i < (openBraces - closeBraces); i++) {
                        cleanedBuffer += '}'
                      }
                    }
                    
                    console.log('Buffer length:', cleanedBuffer.length)
                    console.log('Buffer content (first 200 chars):', cleanedBuffer.substring(0, 200))
                    console.log('Buffer content (last 200 chars):', cleanedBuffer.substring(cleanedBuffer.length - 200))
                    
                    const parsedData = JSON.parse(cleanedBuffer)
                    
                    // Validate the parsed data structure
                    if (!parsedData.vendor_name || !Array.isArray(parsedData.line_items)) {
                      throw new Error('Invalid invoice data structure')
                    }
                    
                    // Save to database
                    await saveInvoiceToDatabase(parsedData, file.name)
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'complete',
                      data: parsedData
                    })}\n\n`))
                  } catch (error) {
                    console.error('Error processing complete response:', error)
                    console.error('Buffer content:', buffer)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      error: 'Failed to process invoice data: ' + (error instanceof Error ? error.message : String(error))
                    })}\n\n`))
                  }
                  
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    buffer += content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'progress',
                      content: 'Processing invoice...'
                    })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON chunks
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to process invoice'
          })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Error processing invoice:', error)
    return NextResponse.json(
      { error: 'Failed to process invoice' },
      { status: 500 }
    )
  }
}

async function saveInvoiceToDatabase(invoiceData: any, filename: string) {
  try {
    // Create or find vendor
    const vendor = await prisma.vendor.upsert({
      where: { name: invoiceData.vendor_name },
      update: {},
      create: { name: invoiceData.vendor_name }
    })

    // Create invoice
    const invoice = await prisma.invoice.create({
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
        product = await prisma.product.upsert({
          where: { name: item.product_name },
          update: {},
          create: { 
            name: item.product_name,
            description: item.product_name
          }
        })
      }

      // Calculate required fields for UI compatibility
      const quantity = item.quantity || 0
      const unitPrice = item.unit_price || 0
      const totalPrice = item.total_price || (quantity * unitPrice)
      const gstApplicable = item.gst_applicable !== undefined ? item.gst_applicable : true
      
      // Calculate final prices (initially same as total price since no category assigned yet)
      const finalPrice = totalPrice
      const gstAmount = gstApplicable ? finalPrice * 0.1 : 0
      const finalPriceIncGst = finalPrice + gstAmount

      await prisma.lineItem.create({
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
          // Initialize calculated fields for UI compatibility
          finalPrice: finalPrice,
          gstAmount: gstAmount,
          finalPriceIncGst: finalPriceIncGst,
          // categoryId remains null until user assigns category
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
