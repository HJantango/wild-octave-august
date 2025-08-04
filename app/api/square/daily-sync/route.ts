
import { NextRequest, NextResponse } from 'next/server';
import { squareSync } from '@/lib/square-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting daily Square sync...');
    
    // Perform the daily sync
    const results = await squareSync.performDailySync();
    
    // Also run auto-linking
    const autoLinkResults = await squareSync.autoLinkProducts();
    
    console.log('Daily sync completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      results: {
        ...results,
        autoLink: autoLinkResults
      }
    });
  } catch (error) {
    console.error('Daily sync failed:', error);
    return NextResponse.json(
      { error: 'Daily sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// This endpoint can be called by external cron services
export async function GET() {
  try {
    // Verify the request is authorized (you might want to add authentication)
    const authHeader = process.env.CRON_SECRET;
    
    console.log('Daily sync triggered via GET request');
    
    const results = await squareSync.performDailySync();
    const autoLinkResults = await squareSync.autoLinkProducts();
    
    return NextResponse.json({ 
      success: true, 
      results: {
        ...results,
        autoLink: autoLinkResults
      }
    });
  } catch (error) {
    console.error('Daily sync failed:', error);
    return NextResponse.json(
      { error: 'Daily sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
