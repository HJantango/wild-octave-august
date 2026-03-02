import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    let where = { isActive: true };
    if (section) {
      where = { ...where, section };
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return createSuccessResponse(templates);
  } catch (error: any) {
    console.error('Error fetching checklists:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, section, items } = body;

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        description,
        section,
        items: {
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
    console.error('Error creating checklist:', error);
    return createErrorResponse('CREATE_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';