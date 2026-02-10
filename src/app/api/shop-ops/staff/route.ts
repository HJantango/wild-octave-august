import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/shop-ops/staff - Get all shop ops staff
export async function GET() {
  try {
    const staff = await prisma.shopOpsStaff.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch staff' } },
      { status: 500 }
    );
  }
}

// POST /api/shop-ops/staff - Create staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, role = 'staff' } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { message: 'Name is required' } },
        { status: 400 }
      );
    }

    const staff = await prisma.shopOpsStaff.create({
      data: {
        name,
        email,
        phone,
        role,
      },
    });

    return NextResponse.json({
      success: true,
      data: staff,
      message: 'Staff member created',
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create staff' } },
      { status: 500 }
    );
  }
}
