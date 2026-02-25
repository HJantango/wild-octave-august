import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/sms-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phones = searchParams.get('phones')?.split(',') || [];

  if (phones.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Usage: /api/debug/test-phones?phones=0412345678,0498765432',
      example: '/api/debug/test-phones?phones=0412345678,0498765432'
    });
  }

  const results = phones.map(phone => {
    const trimmed = phone.trim();
    const isValid = isValidPhoneNumber(trimmed);
    const normalized = isValid ? normalizePhoneNumber(trimmed) : null;

    return {
      original: trimmed,
      isValid,
      normalized,
      reason: !trimmed ? 'Empty phone number' :
               !isValid ? 'Invalid format (needs Australian mobile: 04xx or 05xx)' :
               'Valid ✅'
    };
  });

  const validCount = results.filter(r => r.isValid).length;
  
  return NextResponse.json({
    success: true,
    results,
    summary: {
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
      wouldReceiveSMS: validCount
    },
    tips: [
      "Australian mobiles only: 04xx-xxx-xxx or 05xx-xxx-xxx",
      "Landlines (02, 03, 07, 08) will fail",
      "International numbers will fail",
      "Formatting doesn't matter: spaces, dashes, brackets are stripped"
    ]
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phones = [] } = body;

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Send JSON: {"phones": ["0412345678", "0498765432"]}'
      });
    }

    // Same validation as GET
    const results = phones.map(phone => {
      const trimmed = phone.trim();
      const isValid = isValidPhoneNumber(trimmed);
      const normalized = isValid ? normalizePhoneNumber(trimmed) : null;

      return {
        original: trimmed,
        isValid,
        normalized,
        reason: !trimmed ? 'Empty' :
               !isValid ? 'Invalid format' : 'Valid ✅'
      };
    });

    return NextResponse.json({
      success: true,
      results,
      summary: {
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON in request body'
    });
  }
}