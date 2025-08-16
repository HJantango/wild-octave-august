import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  console.log('🚀 POST REQUEST RECEIVED - Debug version active!')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('📁 File received:', file.name, 'Type:', file.type, 'Size:', file.size)

    // Return immediate mock success for testing
    const mockData = {
      vendor_name: "WORKING! Test Vendor",
      line_items: [
        {
          product_name: "API Route is Working!",
          quantity: 1.0,
          unit_price: 10.00,
          total_price: 10.00,
          gst_applicable: true,
          needs_clarification: false,
          clarification_note: null
        }
      ]
    }

    console.log('✅ Returning mock data - API route is working!')
    
    return NextResponse.json({
      success: true,
      data: mockData,
      message: 'SUCCESS! API route is now working properly'
    })

  } catch (error) {
    console.error('❌ Error in POST handler:', error)
    return NextResponse.json(
      { error: 'Server error: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    )
  }
}

export async function GET() {
  console.log('📡 GET request received')
  return NextResponse.json({
    status: 'API endpoint is working',
    method: 'GET',
    timestamp: new Date().toISOString(),
    message: 'Use POST with a PDF file to process invoices'
  })
}
