import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { squareSync } from '@/lib/square-sync'

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Get recent sync logs
    const syncLogs = await db.syncLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return NextResponse.json({ syncLogs })
  } catch (error) {
    console.error('Error fetching sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json()

    let result;
    
    switch (type) {
      case 'products':
        result = await squareSync.syncProducts()
        break
      case 'inventory':
        result = await squareSync.syncInventory()
        break
      case 'auto-link':
        result = await squareSync.autoLinkProducts()
        break
      case 'daily':
        result = await squareSync.performDailySync()
        break
      default:
        return NextResponse.json(
          { error: 'Invalid sync type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error triggering sync:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}
