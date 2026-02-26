import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const allStaff = await prisma.rosterStaff.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Group by status
    const active = allStaff.filter(s => s.isActive);
    const inactive = allStaff.filter(s => !s.isActive);

    // Identify likely test data
    const testDataPatterns = [
      /test/i,
      /debug/i,
      /example/i,
      /temp/i,
      /demo/i,
      /paige/i // Paige mentioned as old example
    ];

    const likelyTestData = allStaff.filter(staff => 
      testDataPatterns.some(pattern => pattern.test(staff.name))
    );

    return NextResponse.json({
      success: true,
      summary: {
        total: allStaff.length,
        active: active.length,
        inactive: inactive.length,
        withPhones: allStaff.filter(s => s.phone).length,
        likelyTestData: likelyTestData.length
      },
      staff: {
        active: active.map(s => ({
          ...s,
          isLikelyTestData: testDataPatterns.some(pattern => pattern.test(s.name))
        })),
        inactive: inactive.map(s => ({
          ...s,
          isLikelyTestData: testDataPatterns.some(pattern => pattern.test(s.name))
        })),
        testData: likelyTestData
      }
    });

  } catch (error) {
    console.error('Error listing staff:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}