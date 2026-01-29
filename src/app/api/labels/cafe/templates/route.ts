import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all templates (with optional search)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const templates = await prisma.cafeLabelTemplate.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, organic, vegan, glutenFree, ingredients, price, bgColor } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const template = await prisma.cafeLabelTemplate.create({
      data: {
        name: name.trim(),
        organic: organic ?? false,
        vegan: vegan ?? false,
        glutenFree: glutenFree ?? false,
        ingredients: ingredients || null,
        price: price || null,
        bgColor: bgColor || '#E2E3F0',
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating template:', error);
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
