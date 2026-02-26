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
        canDoBarista: true,
        salaryType: true,
        weeklySalary: true,
        baseHourlyRate: true,
        saturdayHourlyRate: true,
        sundayHourlyRate: true,
        publicHolidayHourlyRate: true,
        taxRate: true,
        superRate: true,
        email: true,
        phone: true,
        isActive: true,
      }
    });

    // Convert Decimal to number for JSON serialization
    const formattedStaff = staff.map(person => ({
      ...person,
      weeklySalary: person.weeklySalary ? Number(person.weeklySalary) : null,
      baseHourlyRate: Number(person.baseHourlyRate),
      saturdayHourlyRate: person.saturdayHourlyRate ? Number(person.saturdayHourlyRate) : null,
      sundayHourlyRate: person.sundayHourlyRate ? Number(person.sundayHourlyRate) : null,
      publicHolidayHourlyRate: person.publicHolidayHourlyRate ? Number(person.publicHolidayHourlyRate) : null,
      taxRate: Number(person.taxRate),
      superRate: person.superRate ? Number(person.superRate) : null,
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
    const { name, role, canDoBarista = false, salaryType = 'hourly', weeklySalary, baseHourlyRate, saturdayHourlyRate, sundayHourlyRate, publicHolidayHourlyRate, taxRate, superRate, email, phone, isActive = true } = body;

    if (!name || !role || baseHourlyRate === undefined) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, role, baseHourlyRate' 
        },
        { status: 400 }
      );
    }

    // Default tax rate to 30% if not provided
    const effectiveTaxRate = taxRate !== undefined ? taxRate : 30;
    // Default super rate: null for juniors, 11.5% for others
    const isJunior = role.toLowerCase().includes('junior');
    const effectiveSuperRate = superRate !== undefined ? superRate : (isJunior ? null : 11.5);

    const newStaff = await prisma.rosterStaff.create({
      data: {
        name,
        role,
        canDoBarista,
        salaryType,
        weeklySalary,
        baseHourlyRate,
        saturdayHourlyRate,
        sundayHourlyRate,
        publicHolidayHourlyRate,
        taxRate: effectiveTaxRate,
        superRate: effectiveSuperRate,
        email,
        phone,
        isActive
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newStaff,
        weeklySalary: newStaff.weeklySalary ? Number(newStaff.weeklySalary) : null,
        baseHourlyRate: Number(newStaff.baseHourlyRate),
        saturdayHourlyRate: newStaff.saturdayHourlyRate ? Number(newStaff.saturdayHourlyRate) : null,
        sundayHourlyRate: newStaff.sundayHourlyRate ? Number(newStaff.sundayHourlyRate) : null,
        publicHolidayHourlyRate: newStaff.publicHolidayHourlyRate ? Number(newStaff.publicHolidayHourlyRate) : null,
        taxRate: Number(newStaff.taxRate),
        superRate: newStaff.superRate ? Number(newStaff.superRate) : null,
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
    const { id, name, role, canDoBarista, salaryType, weeklySalary, baseHourlyRate, saturdayHourlyRate, sundayHourlyRate, publicHolidayHourlyRate, taxRate, superRate, email, phone, isActive } = body;

    // HEATH DEBUG: Log everything for the Jackie save
    if (name && name.toLowerCase().includes('jackie')) {
      console.log('🚨 JACKIE UPDATE DEBUG 🚨');
      console.log('Staff ID:', id);
      console.log('Name:', name);
      console.log('Phone input:', phone);
      console.log('Phone type:', typeof phone);
      console.log('Phone length:', phone?.length);
      console.log('Full request body:', JSON.stringify(body, null, 2));
    }

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: id' 
        },
        { status: 400 }
      );
    }

    // Build update data and log for Jackie
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (canDoBarista !== undefined) updateData.canDoBarista = canDoBarista;
    if (salaryType !== undefined) updateData.salaryType = salaryType;
    if (weeklySalary !== undefined) updateData.weeklySalary = weeklySalary;
    if (baseHourlyRate !== undefined) updateData.baseHourlyRate = baseHourlyRate;
    if (saturdayHourlyRate !== undefined) updateData.saturdayHourlyRate = saturdayHourlyRate;
    if (sundayHourlyRate !== undefined) updateData.sundayHourlyRate = sundayHourlyRate;
    if (publicHolidayHourlyRate !== undefined) updateData.publicHolidayHourlyRate = publicHolidayHourlyRate;
    if (taxRate !== undefined) updateData.taxRate = taxRate;
    if (superRate !== undefined) updateData.superRate = superRate;
    if (email !== undefined && email !== null) updateData.email = email;
    if (phone !== undefined && phone !== null) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (name && name.toLowerCase().includes('jackie')) {
      console.log('Phone will be included:', phone !== undefined && phone !== null);
      console.log('Update data phone:', updateData.phone);
      console.log('Full update data:', JSON.stringify(updateData, null, 2));
    }

    const updatedStaff = await prisma.rosterStaff.update({
      where: { id },
      data: updateData
    });

    if (name && name.toLowerCase().includes('jackie')) {
      console.log('Database returned phone:', updatedStaff.phone);
      console.log('Phone match:', updatedStaff.phone === phone);
      console.log('🚨 END JACKIE DEBUG 🚨');
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedStaff,
        weeklySalary: updatedStaff.weeklySalary ? Number(updatedStaff.weeklySalary) : null,
        baseHourlyRate: Number(updatedStaff.baseHourlyRate),
        saturdayHourlyRate: updatedStaff.saturdayHourlyRate ? Number(updatedStaff.saturdayHourlyRate) : null,
        sundayHourlyRate: updatedStaff.sundayHourlyRate ? Number(updatedStaff.sundayHourlyRate) : null,
        publicHolidayHourlyRate: updatedStaff.publicHolidayHourlyRate ? Number(updatedStaff.publicHolidayHourlyRate) : null,
        taxRate: Number(updatedStaff.taxRate),
        superRate: updatedStaff.superRate ? Number(updatedStaff.superRate) : null,
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