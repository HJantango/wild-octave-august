import { NextRequest, NextResponse } from 'next/server';
import { realSquareService } from '@/services/real-square-service';

// Force dynamic rendering - don't pre-render this route during build
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication status
    const isConnected = await realSquareService.connect();
    
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: isConnected,
        requiresAuth: !isConnected,
        message: isConnected 
          ? 'Square API is connected and authenticated' 
          : 'Square API authentication failed. Please check your credentials in .env file.'
      }
    });
  } catch (error) {
    console.error('Error checking Square auth status:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to check Square authentication status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Check connection again
    const connected = await realSquareService.connect();
    
    return NextResponse.json({
      success: true,
      data: {
        isAuthenticated: connected,
        message: connected 
          ? 'Square API connection verified' 
          : 'Square API connection failed. Please check your credentials.'
      }
    });
  } catch (error) {
    console.error('Error re-authenticating Square:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to verify Square connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}