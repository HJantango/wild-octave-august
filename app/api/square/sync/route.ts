
import { NextRequest, NextResponse } from 'next/server';
import { squareSync } from '@/lib/square-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json();
    
    let result;
    switch (type) {
      case 'products':
        result = await squareSync.syncProducts();
        break;
      case 'inventory':
        result = await squareSync.syncInventory();
        break;
      case 'daily':
        result = await squareSync.performDailySync();
        break;
      case 'auto-link':
        result = await squareSync.autoLinkProducts();
        break;
      default:
        return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Square sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync with Square', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get recent sync logs
    const { prisma } = await import('@/lib/db');
    const syncLogs = await prisma.syncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    return NextResponse.json({ syncLogs });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    );
  }
}
