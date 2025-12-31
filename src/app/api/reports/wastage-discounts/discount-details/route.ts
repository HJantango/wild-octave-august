import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const discountType = searchParams.get('discountType');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!discountType) {
      return createErrorResponse('INVALID_PARAMS', 'Discount type is required', 400);
    }

    if (!startDateStr || !endDateStr) {
      return createErrorResponse('INVALID_PARAMS', 'Start and end dates are required', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all discount records for this type
    const discountRecords = await prisma.discountRecord.findMany({
      where: {
        discountType,
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { saleDate: 'desc' },
        { itemName: 'asc' },
      ],
    });

    // Format the results
    const details = discountRecords.map((record) => ({
      itemName: record.itemName,
      discountType: record.discountType,
      discountAmount: Number(record.discountAmount),
      discountPercent: record.discountPercent ? Number(record.discountPercent) : null,
      quantity: Number(record.quantity),
      saleDate: record.saleDate.toISOString(),
    }));

    return createSuccessResponse(details);
  } catch (error: any) {
    console.error('Discount details error:', error);
    return createErrorResponse(
      'DETAILS_ERROR',
      `Failed to fetch discount details: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
