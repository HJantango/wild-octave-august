import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { createUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'check';

    if (action === 'check') {
      // Check if users exist
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      const heathUser = users.find(u => u.email === 'heathjansse@gmail.com');

      return createSuccessResponse({
        totalUsers: users.length,
        users: users,
        heathUserExists: !!heathUser,
        heathUserActive: heathUser?.isActive,
        message: users.length === 0 
          ? 'No users found - database might need seeding'
          : `Found ${users.length} users`,
      });
    }

    if (action === 'create-heath') {
      // Create Heath's admin user
      const email = 'heathjansse@gmail.com';
      const password = 'Nintendo:)2100w';

      // Check if already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Update to ensure active
        const updatedUser = await prisma.user.update({
          where: { email },
          data: { isActive: true },
          select: { id: true, email: true, isActive: true },
        });

        return createSuccessResponse({
          message: 'User already exists - ensured active',
          user: updatedUser,
        });
      }

      // Create new user
      const result = await createUser(email, password, 'Heath Jansse', 'ADMIN');

      if (result.success) {
        return createSuccessResponse({
          message: 'Heath admin user created successfully',
          userId: result.userId,
          email: email,
        });
      } else {
        return createErrorResponse('CREATE_USER_ERROR', result.error || 'Failed to create user', 500);
      }
    }

    if (action === 'create-test') {
      // Create test user for debugging
      const email = 'test@wildoctave.com';
      const password = 'test123';

      const result = await createUser(email, password, 'Test User', 'ADMIN');

      if (result.success) {
        return createSuccessResponse({
          message: 'Test user created successfully',
          userId: result.userId,
          email: email,
          credentials: { email, password },
        });
      } else {
        return createErrorResponse('CREATE_USER_ERROR', result.error || 'Failed to create test user', 500);
      }
    }

    return createErrorResponse('INVALID_ACTION', 'Use action: "check", "create-heath", or "create-test"', 400);
  } catch (error: any) {
    console.error('Auth fix error:', error);
    return createErrorResponse('AUTH_FIX_ERROR', error.message, 500);
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ action: 'check' }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';