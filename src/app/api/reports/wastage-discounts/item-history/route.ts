import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const itemId = searchParams.get('itemId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!itemName && !itemId) {
      return createErrorResponse('INVALID_PARAMS', 'Item name or ID is required', 400);
    }

    if (!startDateStr || !endDateStr) {
      return createErrorResponse('INVALID_PARAMS', 'Start and end dates are required', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // Build where clause for item matching
    const itemWhere: any = itemId
      ? { itemId }
      : {
          OR: [
            { itemName: { equals: itemName, mode: 'insensitive' } },
            { itemName: { contains: itemName, mode: 'insensitive' } },
          ],
        };

    // Fetch wastage records for this item
    const wastageRecords = await prisma.wastageRecord.findMany({
      where: {
        ...itemWhere,
        adjustmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { adjustmentDate: 'desc' },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            category: true,
            subcategory: true,
          },
        },
      },
    });

    // Fetch discount records for this item
    const discountRecords = await prisma.discountRecord.findMany({
      where: {
        ...itemWhere,
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { saleDate: 'desc' },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            category: true,
            subcategory: true,
          },
        },
      },
    });

    // Format wastage records
    const wastageHistory = wastageRecords.map((record) => ({
      date: record.adjustmentDate.toISOString(),
      type: 'wastage',
      adjustmentType: record.adjustmentType,
      quantity: Number(record.quantity),
      cost: Number(record.totalCost),
      location: record.location,
    }));

    // Format discount records
    const discountHistory = discountRecords.map((record) => ({
      date: record.saleDate.toISOString(),
      type: 'discount',
      discountType: record.discountType,
      discountPercent: record.discountPercent ? Number(record.discountPercent) : null,
      discountAmount: Number(record.discountAmount),
      quantity: Number(record.quantity),
      originalPrice: record.originalPrice ? Number(record.originalPrice) : null,
      finalPrice: record.finalPrice ? Number(record.finalPrice) : null,
    }));

    // Calculate totals
    const totals = {
      wastageQty: wastageRecords.reduce((sum, r) => sum + Number(r.quantity), 0),
      wastageCost: wastageRecords.reduce((sum, r) => sum + Number(r.totalCost), 0),
      discountQty: discountRecords.reduce((sum, r) => sum + Number(r.quantity), 0),
      discountAmount: discountRecords.reduce((sum, r) => sum + Number(r.discountAmount), 0),
      totalLoss: 0,
      discount25Percent: 0,
      discount50Percent: 0,
    };
    totals.totalLoss = totals.wastageCost + totals.discountAmount;

    // Calculate 25% and 50% discount totals
    totals.discount25Percent = discountRecords
      .filter(r => {
        if (!r.discountPercent) return false;
        const percent = Number(r.discountPercent);
        return percent >= 20 && percent <= 30;
      })
      .reduce((sum, r) => sum + Number(r.discountAmount), 0);

    totals.discount50Percent = discountRecords
      .filter(r => {
        if (!r.discountPercent) return false;
        const percent = Number(r.discountPercent);
        return percent >= 45 && percent <= 55;
      })
      .reduce((sum, r) => sum + Number(r.discountAmount), 0);

    return createSuccessResponse({
      itemName: wastageRecords[0]?.itemName || discountRecords[0]?.itemName || itemName,
      itemId: wastageRecords[0]?.itemId || discountRecords[0]?.itemId || itemId,
      wastageHistory,
      discountHistory,
      totals,
    });
  } catch (error: any) {
    console.error('Item history error:', error);
    return createErrorResponse(
      'HISTORY_ERROR',
      `Failed to fetch item history: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
