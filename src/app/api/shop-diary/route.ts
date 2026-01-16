import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

// GET all shop diary entries
async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const showCompleted = searchParams.get('showCompleted') === 'true';
    
    const where: any = {};
    if (!showCompleted) {
      where.isCompleted = false;
    }

    const entries = await prisma.shopDiaryEntry.findMany({
      where,
      orderBy: [
        { isCompleted: 'asc' },
        { urgency: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return createSuccessResponse(entries);
  } catch (error) {
    console.error('Shop diary fetch error:', error);
    return createErrorResponse('FETCH_ERROR', 'Failed to fetch shop diary entries', 500);
  }
}

// POST create new shop diary entry
async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, urgency, assignedTo, dueDate, createdBy } = body;

    if (!title) {
      return createErrorResponse('VALIDATION_ERROR', 'Title is required', 400);
    }

    const entry = await prisma.shopDiaryEntry.create({
      data: {
        title,
        description,
        urgency: urgency || 'medium',
        assignedTo,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdBy
      }
    });

    return createSuccessResponse(entry, 'Entry created successfully', 201);
  } catch (error) {
    console.error('Shop diary creation error:', error);
    return createErrorResponse('CREATE_ERROR', 'Failed to create entry', 500);
  }
}

export { GET, POST };
export const dynamic = 'force-dynamic';
