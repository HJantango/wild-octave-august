import { NextRequest, NextResponse } from 'next/server';
import { createAuthSession, validateAccessToken } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = loginSchema.parse(body);

    if (!validateAccessToken(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid access token' } },
        { status: 401 }
      );
    }

    const success = await createAuthSession(token);
    
    if (!success) {
      return NextResponse.json(
        { error: { code: 'SESSION_ERROR', message: 'Failed to create session' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Authentication successful' 
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid request data',
            details: error.errors 
          } 
        },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}