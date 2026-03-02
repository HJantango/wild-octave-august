import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    return NextResponse.json({
      session,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check session',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';