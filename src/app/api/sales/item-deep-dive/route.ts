import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { z } from 'zod';

const itemDeepDiveSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gapThreshold: z.coerce.number().min(1).max(30).default(3), // Consecutive zero days to count as gap
});

interface DailySale {
  date: Date;
  quantity: number;
  revenue: number;
}

interface GapPeriod {
  startDate: string;
  endDate: string;
  days: number;
}

function detectGaps(salesData: DailySale[], gapThreshold: number): { gaps: GapPeriod[]; totalGapDays: number } {
  if (salesData.length === 0) return { gaps: [], totalGapDays: 0 };

  // Get the full date range
  const sortedDates = salesData.map(s => s.date.getTime()).sort((a, b) => a - b);
  const minDate = new Date(sortedDates[0]);
  const maxDate = new Date(sortedDates[sortedDates.length - 1]);

  // Create a set of dates with sales for O(1) lookup
  const datesWithSales = new Set(
    salesData
      .filter(s => s.quantity > 0)
      .map(s => s.date.toISOString().split('T')[0])
  );

  const gaps: GapPeriod[] = [];
  let currentGapStart: Date | null = null;
  let consecutiveZeroDays = 0;

  // Iterate through each day in the range
  const currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const hasSales = datesWithSales.has(dateKey);

    if (!hasSales) {
      if (currentGapStart === null) {
        currentGapStart = new Date(currentDate);
      }
      consecutiveZeroDays++;
    } else {
      // End of gap period
      if (currentGapStart !== null && consecutiveZeroDays >= gapThreshold) {
        const gapEnd = new Date(currentDate);
        gapEnd.setDate(gapEnd.getDate() - 1);
        gaps.push({
          startDate: currentGapStart.toISOString().split('T')[0],
          endDate: gapEnd.toISOString().split('T')[0],
          days: consecutiveZeroDays,
        });
      }
      currentGapStart = null;
      consecutiveZeroDays = 0;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Handle trailing gap
  if (currentGapStart !== null && consecutiveZeroDays >= gapThreshold) {
    gaps.push({
      startDate: currentGapStart.toISOString().split('T')[0],
      endDate: maxDate.toISOString().split('T')[0],
      days: consecutiveZeroDays,
    });
  }

  const totalGapDays = gaps.reduce((sum, gap) => sum + gap.days, 0);

  return { gaps, totalGapDays };
}

function calculateWeekdayBreakdown(salesData: DailySale[]) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const breakdown = weekdays.map((name, index) => ({
    dayOfWeek: index,
    dayName: name,
    totalQuantity: 0,
    totalRevenue: 0,
    daysWithSales: 0,
  }));

  salesData.forEach(sale => {
    const dow = sale.date.getDay();
    breakdown[dow].totalQuantity += sale.quantity;
    breakdown[dow].totalRevenue += sale.revenue;
    if (sale.quantity > 0) {
      breakdown[dow].daysWithSales++;
    }
  });

  return breakdown.map(day => ({
    ...day,
    averageQuantity: day.daysWithSales > 0 ? day.totalQuantity / day.daysWithSales : 0,
    averageRevenue: day.daysWithSales > 0 ? day.totalRevenue / day.daysWithSales : 0,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = itemDeepDiveSchema.safeParse(searchParams);

    if (!parsed.success) {
      return createErrorResponse('VALIDATION_ERROR', parsed.error.message, 400);
    }

    const { itemId, itemName, startDate, endDate, gapThreshold } = parsed.data;

    if (!itemId && !itemName) {
      return createErrorResponse('VALIDATION_ERROR', 'Either itemId or itemName is required', 400);
    }

    // If itemId provided, look up the item to get its name
    let searchName = itemName;
    let item = null;

    if (itemId) {
      item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          vendor: { select: { id: true, name: true } },
          inventoryItem: { select: { currentStock: true, minimumStock: true, lastStockTake: true } },
        },
      });

      if (!item) {
        return createErrorResponse('NOT_FOUND', 'Item not found', 404);
      }

      searchName = item.name;
    }

    // Build where clause for sales data
    const where: any = {};

    // Try exact match first, then contains
    if (searchName) {
      where.itemName = searchName;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Fetch sales data from Square
    let salesRecords = await prisma.squareDailySales.findMany({
      where,
      select: {
        date: true,
        quantitySold: true,
        netSalesCents: true,
        grossSalesCents: true,
        category: true,
        variationName: true,
      },
      orderBy: { date: 'asc' },
    });

    // If no exact match, try contains search
    if (salesRecords.length === 0 && searchName) {
      salesRecords = await prisma.squareDailySales.findMany({
        where: {
          ...where,
          itemName: { contains: searchName, mode: 'insensitive' },
        },
        select: {
          date: true,
          quantitySold: true,
          netSalesCents: true,
          grossSalesCents: true,
          category: true,
          variationName: true,
        },
        orderBy: { date: 'asc' },
      });
    }

    // Convert to standard format
    const salesData: DailySale[] = salesRecords.map(r => ({
      date: r.date,
      quantity: Number(r.quantitySold || 0),
      revenue: (r.netSalesCents || 0) / 100,
    }));

    // Calculate date range
    const dateRange = {
      start: salesData.length > 0 ? salesData[0].date.toISOString().split('T')[0] : null,
      end: salesData.length > 0 ? salesData[salesData.length - 1].date.toISOString().split('T')[0] : null,
      totalDays: 0,
    };

    if (dateRange.start && dateRange.end) {
      const startMs = new Date(dateRange.start).getTime();
      const endMs = new Date(dateRange.end).getTime();
      dateRange.totalDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Detect gaps (out-of-stock periods)
    const { gaps, totalGapDays } = detectGaps(salesData, gapThreshold);

    // Calculate totals
    const totalQuantity = salesData.reduce((sum, s) => sum + s.quantity, 0);
    const totalRevenue = salesData.reduce((sum, s) => sum + s.revenue, 0);
    const daysWithSales = salesData.filter(s => s.quantity > 0).length;

    // Calculate averages
    const availableDays = dateRange.totalDays - totalGapDays;
    const rawDailyAverage = dateRange.totalDays > 0 ? totalQuantity / dateRange.totalDays : 0;
    const adjustedDailyAverage = availableDays > 0 ? totalQuantity / availableDays : 0;

    // Weekly averages
    const totalWeeks = dateRange.totalDays / 7;
    const availableWeeks = availableDays / 7;
    const rawWeeklyAverage = totalWeeks > 0 ? totalQuantity / totalWeeks : 0;
    const adjustedWeeklyAverage = availableWeeks > 0 ? totalQuantity / availableWeeks : 0;

    // Weekday breakdown
    const weekdayBreakdown = calculateWeekdayBreakdown(salesData);

    // Daily timeline for charting (last 90 days or full range if shorter)
    const timelineStart = new Date();
    timelineStart.setDate(timelineStart.getDate() - 90);
    
    const timeline = salesData
      .filter(s => !startDate || s.date >= timelineStart)
      .map(s => ({
        date: s.date.toISOString().split('T')[0],
        quantity: s.quantity,
        revenue: s.revenue,
        isGap: false, // Will be filled in below
      }));

    // Mark gap days in timeline
    gaps.forEach(gap => {
      const gapStart = new Date(gap.startDate);
      const gapEnd = new Date(gap.endDate);
      timeline.forEach(day => {
        const dayDate = new Date(day.date);
        if (dayDate >= gapStart && dayDate <= gapEnd) {
          day.isGap = true;
        }
      });
    });

    // Order prediction (next 6 weeks)
    const currentStock = item?.inventoryItem?.currentStock 
      ? Number(item.inventoryItem.currentStock) 
      : null;

    const orderPrediction = {
      weeksToProject: 6,
      adjustedWeeklyRate: adjustedWeeklyAverage,
      projectedNeed: adjustedWeeklyAverage * 6,
      currentStock,
      suggestedOrder: currentStock !== null 
        ? Math.max(0, Math.ceil(adjustedWeeklyAverage * 6 - currentStock))
        : null,
    };

    return createSuccessResponse({
      item: item ? {
        id: item.id,
        name: item.name,
        category: item.category,
        vendor: item.vendor,
        currentStock: item.inventoryItem?.currentStock ? Number(item.inventoryItem.currentStock) : null,
        lastStockTake: item.inventoryItem?.lastStockTake,
      } : {
        name: searchName,
      },
      dateRange,
      totals: {
        quantity: totalQuantity,
        revenue: totalRevenue,
        daysWithSales,
      },
      gaps: {
        threshold: gapThreshold,
        periods: gaps,
        totalGapDays,
        availableDays,
        availabilityPercent: dateRange.totalDays > 0 
          ? ((availableDays / dateRange.totalDays) * 100).toFixed(1)
          : '100',
      },
      averages: {
        raw: {
          daily: rawDailyAverage,
          weekly: rawWeeklyAverage,
        },
        adjusted: {
          daily: adjustedDailyAverage,
          weekly: adjustedWeeklyAverage,
        },
        improvement: rawWeeklyAverage > 0 
          ? (((adjustedWeeklyAverage - rawWeeklyAverage) / rawWeeklyAverage) * 100).toFixed(1)
          : '0',
      },
      weekdayBreakdown,
      timeline,
      orderPrediction,
    });

  } catch (error) {
    console.error('Item deep dive error:', error);
    return createErrorResponse('DEEP_DIVE_ERROR', 'Failed to analyze item sales', 500);
  }
}

export const dynamic = 'force-dynamic';
