import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weeks = parseInt(searchParams.get('weeks') || '6');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Get all Liz Jackson items raw
    const sales = await prisma.squareDailySales.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        vendorName: { contains: 'liz jackson', mode: 'insensitive' },
      },
      orderBy: [
        { itemName: 'asc' },
        { variationName: 'asc' },
        { date: 'desc' },
      ],
    });

    // Group and summarize
    const summary: Record<string, { 
      totalQty: number; 
      days: number; 
      avgPerDay: number;
      records: Array<{ date: string; qty: number }>;
    }> = {};

    for (const record of sales) {
      const key = record.variationName 
        ? `${record.itemName} - ${record.variationName}`
        : record.itemName;
      
      if (!summary[key]) {
        summary[key] = { totalQty: 0, days: 0, avgPerDay: 0, records: [] };
      }
      
      const qty = Number(record.quantitySold);
      summary[key].totalQty += qty;
      summary[key].days += 1;
      summary[key].records.push({
        date: record.date.toISOString().split('T')[0],
        qty,
      });
    }

    // Calculate averages
    const uniqueDates = new Set(sales.map(s => s.date.toISOString().split('T')[0]));
    const totalDays = uniqueDates.size || 1;

    for (const key of Object.keys(summary)) {
      summary[key].avgPerDay = summary[key].totalQty / totalDays;
    }

    return createSuccessResponse({
      totalRecords: sales.length,
      totalDays,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      items: Object.entries(summary)
        .sort((a, b) => b[1].totalQty - a[1].totalQty)
        .map(([name, data]) => ({
          name,
          totalSold: data.totalQty,
          daysWithSales: data.days,
          avgPerDay: parseFloat(data.avgPerDay.toFixed(2)),
          recentSales: data.records.slice(0, 10),
        })),
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return createErrorResponse('DEBUG_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
