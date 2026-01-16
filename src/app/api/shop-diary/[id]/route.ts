import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET single shop diary entry
async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entry = await prisma.shopDiaryEntry.findUnique({
      where: { id: params.id }
    });

    if (!entry) {
      return createErrorResponse('NOT_FOUND', 'Entry not found', 404);
    }

    return createSuccessResponse(entry);
  } catch (error) {
    console.error('Shop diary fetch error:', error);
    return createErrorResponse('FETCH_ERROR', 'Failed to fetch entry', 500);
  }
}

// PUT update shop diary entry
async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { title, description, urgency, assignedTo, dueDate } = body;

    const entry = await prisma.shopDiaryEntry.update({
      where: { id: params.id },
      data: {
        title,
        description,
        urgency,
        assignedTo,
        dueDate: dueDate ? new Date(dueDate) : null,
      }
    });

    return createSuccessResponse(entry, 'Entry updated successfully');
  } catch (error) {
    console.error('Shop diary update error:', error);
    return createErrorResponse('UPDATE_ERROR', 'Failed to update entry', 500);
  }
}

// DELETE shop diary entry
async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.shopDiaryEntry.delete({
      where: { id: params.id }
    });

    return createSuccessResponse(null, 'Entry deleted successfully');
  } catch (error) {
    console.error('Shop diary delete error:', error);
    return createErrorResponse('DELETE_ERROR', 'Failed to delete entry', 500);
  }
}

// PATCH toggle completion status
async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isCompleted, completedBy } = body;

    const entry = await prisma.shopDiaryEntry.update({
      where: { id: params.id },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? completedBy : null,
      }
    });

    return createSuccessResponse(entry, 'Entry status updated');
  } catch (error) {
    console.error('Shop diary status update error:', error);
    return createErrorResponse('UPDATE_ERROR', 'Failed to update status', 500);
  }
}

export { GET, PUT, DELETE, PATCH };
export const dynamic = 'force-dynamic';
