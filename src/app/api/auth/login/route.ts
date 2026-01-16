import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createAuthSession } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const result = await authenticateUser(email, password);

    if (!result.success || !result.userId || !result.email) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: result.error || 'Invalid email or password' } },
        { status: 401 }
      );
    }

    const sessionCreated = await createAuthSession(result.userId, result.email);

    if (!sessionCreated) {
      return NextResponse.json(
        { error: { code: 'SESSION_ERROR', message: 'Failed to create session' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user: {
        email: result.email,
        role: result.role,
      },
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
