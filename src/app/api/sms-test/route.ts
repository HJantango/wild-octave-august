import { NextRequest, NextResponse } from 'next/server';
import { sendRosterSMS, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/sms-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const name = searchParams.get('name') || 'Test User';

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Phone number required. Use: /api/sms-test?phone=0412345678&name=Heath'
      }, { status: 400 });
    }

    // Validate phone number
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json({
        success: false,
        error: `Invalid phone number format: ${phone}. Use Australian format like 0412345678`
      }, { status: 400 });
    }

    console.log(`🧪 Testing SMS to ${name} at ${phone}`);

    // Create a fake roster image buffer (empty for test)
    const fakeRosterBuffer = Buffer.from('test');
    
    // Use current week for test
    const testWeek = new Date();
    testWeek.setDate(testWeek.getDate() - testWeek.getDay() + 1); // Get Monday of current week

    // Send test SMS
    const result = await sendRosterSMS(
      normalizePhoneNumber(phone),
      name,
      fakeRosterBuffer,
      testWeek
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `✅ Test SMS sent successfully to ${name} at ${phone}`,
        details: {
          messageSid: result.messageSid,
          normalizedPhone: normalizePhoneNumber(phone),
          weekDate: testWeek.toLocaleDateString('en-AU'),
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Failed to send SMS: ${result.error}`,
        details: result
      }, { status: 500 });
    }

  } catch (error) {
    console.error('SMS Test Error:', error);
    return NextResponse.json({
      success: false,
      error: 'SMS test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name = 'Test User' } = body;

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Phone number required in request body'
      }, { status: 400 });
    }

    // Same logic as GET but using POST body
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json({
        success: false,
        error: `Invalid phone number format: ${phone}`
      }, { status: 400 });
    }

    const fakeRosterBuffer = Buffer.from('test');
    const testWeek = new Date();
    testWeek.setDate(testWeek.getDate() - testWeek.getDay() + 1);

    const result = await sendRosterSMS(
      normalizePhoneNumber(phone),
      name,
      fakeRosterBuffer,
      testWeek
    );

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `✅ Test SMS sent to ${name} at ${phone}` 
        : `❌ Failed to send SMS: ${result.error}`,
      details: result
    });

  } catch (error) {
    console.error('SMS Test Error:', error);
    return NextResponse.json({
      success: false,
      error: 'SMS test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}