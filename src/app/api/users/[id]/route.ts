import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return createSuccessResponse(user, 'User updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid request data',
        400,
        error.errors
      );
    }

    if (error.code === 'P2025') {
      return createErrorResponse('NOT_FOUND', 'User not found', 404);
    }

    console.error('Failed to update user:', error);
    return createErrorResponse('UPDATE_ERROR', 'Failed to update user', 500);
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.user.delete({
      where: { id: params.id },
    });

    return createSuccessResponse(null, 'User deleted successfully');
  } catch (error: any) {
    if (error.code === 'P2025') {
      return createErrorResponse('NOT_FOUND', 'User not found', 404);
    }

    console.error('Failed to delete user:', error);
    return createErrorResponse('DELETE_ERROR', 'Failed to delete user', 500);
  }
}
