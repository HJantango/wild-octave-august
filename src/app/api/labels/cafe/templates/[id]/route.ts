import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE - Remove a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.cafeLabelTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting template:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}

// PUT - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, organic, vegan, glutenFree, ingredients, price, bgColor } = body;

    const template = await prisma.cafeLabelTemplate.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(organic !== undefined && { organic }),
        ...(vegan !== undefined && { vegan }),
        ...(glutenFree !== undefined && { glutenFree }),
        ...(ingredients !== undefined && { ingredients: ingredients || null }),
        ...(price !== undefined && { price: price || null }),
        ...(bgColor && { bgColor }),
      },
    });

    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error('Error updating template:', error);
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
