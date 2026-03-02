import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: params.id },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!template) {
      return createErrorResponse('NOT_FOUND', 'Checklist not found', 404);
    }

    return createSuccessResponse(template);
  } catch (error: any) {
    console.error('Error fetching checklist:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, section, items } = body;

    // Update template and replace all items
    const template = await prisma.checklistTemplate.update({
      where: { id: params.id },
      data: {
        name,
        description,
        section,
        items: {
          deleteMany: {}, // Remove existing items
          create: items?.map((item: any, index: number) => ({
            title: item.title,
            description: item.description,
            frequency: item.frequency || 'daily',
            specificDays: item.specificDays || [],
            sortOrder: index,
          })) || [],
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return createSuccessResponse(template);
  } catch (error: any) {
    console.error('Error updating checklist:', error);
    return createErrorResponse('UPDATE_ERROR', error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.checklistTemplate.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return createSuccessResponse({ message: 'Checklist deactivated' });
  } catch (error: any) {
    console.error('Error deleting checklist:', error);
    return createErrorResponse('DELETE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';