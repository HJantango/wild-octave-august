import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { createUser } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return createSuccessResponse(users, 'Users retrieved successfully');
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return createErrorResponse('FETCH_ERROR', 'Failed to fetch users', 500);
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    const result = await createUser(
      validatedData.email,
      validatedData.password,
      validatedData.name,
      validatedData.role
    );

    if (!result.success) {
      return createErrorResponse(
        'CREATE_ERROR',
        result.error || 'Failed to create user',
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return createSuccessResponse(user, 'User created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid request data',
        400,
        error.errors
      );
    }

    console.error('Failed to create user:', error);
    return createErrorResponse('CREATE_ERROR', 'Failed to create user', 500);
  }
}
