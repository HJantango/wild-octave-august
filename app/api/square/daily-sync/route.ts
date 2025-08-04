
import { NextRequest, NextResponse } from 'next/server';
import { getSquareSync } from '@/lib/square-sync';
import { canInitializeSquareClient } from '@/lib/square-client-wrapper';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check if Square client can be initialized
    if (!canInitializeSquareClient()) {
      console.error('Square API not available - missing configuration');
      return NextResponse.json(
        { error: 'Square API not configured', details: 'Missing Square access token or other required configuration' },
        { status: 503 }
      );
    }

    console.log('Starting daily Square sync...');
    
    // Get Square sync service instance
    const squareSyncService = getSquareSync();
    
    // Perform the daily sync
    const results = await squareSyncService.performDailySync();
    
    // Also run auto-linking
    const autoLinkResults = await squareSyncService.autoLinkProducts();
    
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
    // Check if Square client can be initialized
    if (!canInitializeSquareClient()) {
      console.error('Square API not available - missing configuration');
      return NextResponse.json(
        { error: 'Square API not configured', details: 'Missing Square access token or other required configuration' },
        { status: 503 }
      );
    }

    // Verify the request is authorized (you might want to add authentication)
    const authHeader = process.env.CRON_SECRET;
    
    console.log('Daily sync triggered via GET request');
    
    // Get Square sync service instance
    const squareSyncService = getSquareSync();
    
    const results = await squareSyncService.performDailySync();
    const autoLinkResults = await squareSyncService.autoLinkProducts();
    
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
