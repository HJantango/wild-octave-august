import { NextRequest, NextResponse } from 'next/server'
import { squareSync } from '@/lib/square-sync'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    console.log('Starting daily sync...')
    
    // Perform the daily sync
    const results = await squareSync.performDailySync()
    const autoLinkResults = await squareSync.autoLinkProducts()
    
    console.log('Daily sync completed successfully:', {
      products: results.products,
      inventory: results.inventory,
      autoLink: autoLinkResults
    })
    
    return NextResponse.json({
      success: true,
      results: {
        products: results.products,
        inventory: results.inventory,
        autoLink: autoLinkResults
      },
      message: 'Daily sync completed successfully'
    })
    
  } catch (error) {
    console.error('Daily sync failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Daily sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return sync status or trigger sync
  return NextResponse.json({
    message: 'Daily sync endpoint is active. Use POST to trigger sync.',
    timestamp: new Date().toISOString()
  })
}
