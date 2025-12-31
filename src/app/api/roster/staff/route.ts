import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET() {
  try {
    const staff = await prisma.rosterStaff.findMany({
      orderBy: [
        { role: 'desc' }, // managers first
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        role: true,
        baseHourlyRate: true,
        saturdayHourlyRate: true,
        sundayHourlyRate: true,
        publicHolidayHourlyRate: true,
        email: true,
        phone: true,
        isActive: true,
      }
    });

    // Convert Decimal to number for JSON serialization
    const formattedStaff = staff.map(person => ({
      ...person,
      baseHourlyRate: Number(person.baseHourlyRate),
      saturdayHourlyRate: person.saturdayHourlyRate ? Number(person.saturdayHourlyRate) : null,
      sundayHourlyRate: person.sundayHourlyRate ? Number(person.sundayHourlyRate) : null,
      publicHolidayHourlyRate: person.publicHolidayHourlyRate ? Number(person.publicHolidayHourlyRate) : null,
    }));

    return NextResponse.json({
      success: true,
      data: formattedStaff
    });

  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch staff data' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, baseHourlyRate, saturdayHourlyRate, sundayHourlyRate, publicHolidayHourlyRate, email, phone, isActive = true } = body;

    if (!name || !role || baseHourlyRate === undefined) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, role, baseHourlyRate' 
        },
        { status: 400 }
      );
    }

    const newStaff = await prisma.rosterStaff.create({
      data: {
        name,
        role,
        baseHourlyRate,
        saturdayHourlyRate,
        sundayHourlyRate,
        publicHolidayHourlyRate,
        email,
        phone,
        isActive
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newStaff,
        baseHourlyRate: Number(newStaff.baseHourlyRate),
        saturdayHourlyRate: newStaff.saturdayHourlyRate ? Number(newStaff.saturdayHourlyRate) : null,
        sundayHourlyRate: newStaff.sundayHourlyRate ? Number(newStaff.sundayHourlyRate) : null,
        publicHolidayHourlyRate: newStaff.publicHolidayHourlyRate ? Number(newStaff.publicHolidayHourlyRate) : null,
      }
    });

  } catch (error: unknown) {
    console.error('Error creating staff:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Staff member with this name already exists' 
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create staff member' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role, baseHourlyRate, saturdayHourlyRate, sundayHourlyRate, publicHolidayHourlyRate, email, phone, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: id' 
        },
        { status: 400 }
      );
    }

    const updatedStaff = await prisma.rosterStaff.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(baseHourlyRate !== undefined && { baseHourlyRate }),
        ...(saturdayHourlyRate !== undefined && { saturdayHourlyRate }),
        ...(sundayHourlyRate !== undefined && { sundayHourlyRate }),
        ...(publicHolidayHourlyRate !== undefined && { publicHolidayHourlyRate }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedStaff,
        baseHourlyRate: Number(updatedStaff.baseHourlyRate),
        saturdayHourlyRate: updatedStaff.saturdayHourlyRate ? Number(updatedStaff.saturdayHourlyRate) : null,
        sundayHourlyRate: updatedStaff.sundayHourlyRate ? Number(updatedStaff.sundayHourlyRate) : null,
        publicHolidayHourlyRate: updatedStaff.publicHolidayHourlyRate ? Number(updatedStaff.publicHolidayHourlyRate) : null,
      }
    });

  } catch (error: unknown) {
    console.error('Error updating staff:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Staff member with this name already exists' 
        },
        { status: 409 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Staff member not found' 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update staff member' 
      },
      { status: 500 }
    );
  }
}