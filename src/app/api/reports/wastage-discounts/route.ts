import { NextRequest, NextResponse } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

interface ItemAggregation {
  itemId?: string;
  itemName: string;
  vendorName?: string;
  category?: string;
  subcategory?: string;
  wastageQty: number;
  wastageCost: number;
  discountQty: number;
  discountAmount: number;
  totalLoss: number;
  recommendation?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return createErrorResponse('INVALID_PARAMS', 'Start and end dates are required', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999); // End of day

    // Fetch wastage records
    const wastageRecords = await prisma.wastageRecord.findMany({
      where: {
        adjustmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            category: true,
            subcategory: true,
            vendor: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Fetch discount records
    const discountRecords = await prisma.discountRecord.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            category: true,
            subcategory: true,
            vendor: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Aggregate by item
    const itemMap = new Map<string, ItemAggregation>();

    // Process wastage records
    for (const record of wastageRecords) {
      const itemKey = record.itemId || `name:${record.itemName}`;
      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          itemId: record.itemId || undefined,
          itemName: record.item?.name || record.itemName,
          vendorName: record.item?.vendor?.name || record.vendorName || undefined,
          category: record.item?.category || undefined,
          subcategory: record.item?.subcategory || undefined,
          wastageQty: 0,
          wastageCost: 0,
          discountQty: 0,
          discountAmount: 0,
          totalLoss: 0,
        });
      }

      const item = itemMap.get(itemKey)!;
      item.wastageQty += Number(record.quantity);
      item.wastageCost += Number(record.totalCost);
      item.totalLoss += Number(record.totalCost);
    }

    // Process discount records
    for (const record of discountRecords) {
      const itemKey = record.itemId || `name:${record.itemName}`;
      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          itemId: record.itemId || undefined,
          itemName: record.item?.name || record.itemName,
          vendorName: record.item?.vendor?.name || undefined,
          category: record.item?.category || undefined,
          subcategory: record.item?.subcategory || undefined,
          wastageQty: 0,
          wastageCost: 0,
          discountQty: 0,
          discountAmount: 0,
          totalLoss: 0,
        });
      }

      const item = itemMap.get(itemKey)!;
      item.discountQty += Number(record.quantity);
      item.discountAmount += Number(record.discountAmount);
      item.totalLoss += Number(record.discountAmount);
    }

    // Add recommendations based on thresholds
    const items = Array.from(itemMap.values()).map(item => {
      if (item.totalLoss > 100) {
        item.recommendation = 'CRITICAL - Stop ordering or significantly reduce';
      } else if (item.totalLoss > 50) {
        item.recommendation = 'HIGH - Order less';
      } else if (item.wastageQty > 10 || item.discountQty > 10) {
        item.recommendation = 'MODERATE - Review ordering frequency';
      }
      return item;
    });

    // Sort by total loss (descending)
    items.sort((a, b) => b.totalLoss - a.totalLoss);

    // Calculate discount type breakdown
    const discountTypeBreakdown = new Map<string, { count: number; amount: number }>();
    for (const record of discountRecords) {
      const type = record.discountType || 'Uncategorized';
      const existing = discountTypeBreakdown.get(type) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(record.discountAmount);
      discountTypeBreakdown.set(type, existing);
    }

    return createSuccessResponse({
      items,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      summary: {
        totalWastageCost: items.reduce((sum, item) => sum + item.wastageCost, 0),
        totalWastageQty: items.reduce((sum, item) => sum + item.wastageQty, 0),
        totalDiscountAmount: items.reduce((sum, item) => sum + item.discountAmount, 0),
        totalDiscountQty: items.reduce((sum, item) => sum + item.discountQty, 0),
        totalLoss: items.reduce((sum, item) => sum + item.totalLoss, 0),
        itemCount: items.length,
      },
      discountTypeBreakdown: Array.from(discountTypeBreakdown.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount,
      })).sort((a, b) => b.amount - a.amount),
    });
  } catch (error: any) {
    console.error('Wastage/discount report error:', error);
    return createErrorResponse(
      'REPORT_ERROR',
      `Failed to generate report: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
