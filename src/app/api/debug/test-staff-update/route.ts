import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testScenario = "add_phone" } = body;

    console.log('=== STAFF UPDATE DEBUG TEST ===');
    console.log('Test scenario:', testScenario);

    // Get an existing staff member for testing
    const existingStaff = await prisma.rosterStaff.findFirst({
      where: { name: { not: "Heath" } }, // Don't mess with Heath's record
      select: { id: true, name: true, phone: true, role: true, baseHourlyRate: true }
    });

    if (!existingStaff) {
      return NextResponse.json({
        success: false,
        error: 'No test staff found'
      });
    }

    console.log('Testing with staff:', existingStaff);

    if (testScenario === "add_phone") {
      // Test 1: Add phone number to staff member
      console.log('--- Test 1: Adding phone number ---');
      
      const updateResult1 = await prisma.rosterStaff.update({
        where: { id: existingStaff.id },
        data: {
          phone: "0412345678" // Add phone number
        }
      });

      console.log('After adding phone:', updateResult1.phone);

      // Test 2: Update other fields, sending phone as null (the bug scenario)
      console.log('--- Test 2: Editing with phone=null (bug scenario) ---');
      
      // This simulates what the frontend does when phone field is empty
      const phone = null;
      const updateData: any = {
        name: existingStaff.name + " (updated)",
        role: "Updated Role"
      };

      // This is the problematic logic - let's see what happens
      if (phone !== undefined && phone !== null) {
        updateData.phone = phone;
        console.log('Phone would be included in update');
      } else {
        console.log('Phone excluded from update (this is good)');
      }

      const updateResult2 = await prisma.rosterStaff.update({
        where: { id: existingStaff.id },
        data: updateData
      });

      console.log('After editing with null phone:', updateResult2.phone);

      return NextResponse.json({
        success: true,
        results: {
          original: existingStaff,
          afterAddingPhone: updateResult1.phone,
          afterEditingWithNull: updateResult2.phone,
          phonePersisted: updateResult2.phone === "0412345678"
        }
      });

    } else if (testScenario === "frontend_simulation") {
      // Test the exact frontend logic
      console.log('--- Frontend Simulation Test ---');

      // Simulate frontend form data
      const formPhone = ""; // Empty form field
      const processedPhone = formPhone.trim() || null; // Frontend logic

      console.log('Form phone:', formPhone);
      console.log('Processed phone:', processedPhone);
      console.log('Processed phone type:', typeof processedPhone);

      // Simulate the API update logic
      const updateData: any = {};
      if (processedPhone !== undefined && processedPhone !== null) {
        updateData.phone = processedPhone;
        console.log('Phone WOULD be included in update - this is the bug!');
      } else {
        console.log('Phone correctly excluded from update');
      }

      return NextResponse.json({
        success: true,
        simulation: {
          formPhone,
          processedPhone,
          processedPhoneType: typeof processedPhone,
          wouldUpdatePhone: processedPhone !== undefined && processedPhone !== null,
          updateData
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown test scenario'
    });

  } catch (error) {
    console.error('Staff update test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}