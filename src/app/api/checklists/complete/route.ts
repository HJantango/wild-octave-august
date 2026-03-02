import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, date, completedBy, notes } = body;

    if (!itemId || !date) {
      return createErrorResponse('VALIDATION_ERROR', 'itemId and date are required', 400);
    }

    const completion = await prisma.checklistCompletion.upsert({
      where: {
        itemId_date: {
          itemId,
          date: new Date(date),
        },
      },
      update: {
        completedBy,
        notes,
        completedAt: new Date(),
      },
      create: {
        itemId,
        date: new Date(date),
        completedBy,
        notes,
      },
      include: {
        item: {
          select: {
            title: true,
          },
        },
      },
    });

    return createSuccessResponse(completion);
  } catch (error: any) {
    console.error('Error completing checklist item:', error);
    return createErrorResponse('COMPLETE_ERROR', error.message, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, date } = body;

    if (!itemId || !date) {
      return createErrorResponse('VALIDATION_ERROR', 'itemId and date are required', 400);
    }

    await prisma.checklistCompletion.delete({
      where: {
        itemId_date: {
          itemId,
          date: new Date(date),
        },
      },
    });

    return createSuccessResponse({ message: 'Completion removed' });
  } catch (error: any) {
    console.error('Error removing completion:', error);
    return createErrorResponse('DELETE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';