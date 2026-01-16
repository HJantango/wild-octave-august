import { NextResponse } from 'next/server';
import { destroyAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await destroyAuthSession();
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}