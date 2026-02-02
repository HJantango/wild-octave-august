import { NextRequest } from 'next/server';
import { prisma } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Health check for sales data - completely public
export async function GET(request: NextRequest) {
  try {
    const totalRecords = await prisma.salesAggregate.count();
    const reportCount = await prisma.salesReport.count();
    
    const dateRange = await prisma.salesAggregate.aggregate({
      _min: { date: true },
      _max: { date: true },
    });

    return Response.json({
      ok: true,
      sales: {
        aggregateRecords: totalRecords,
        reportCount: reportCount,
        dateRange: {
          earliest: dateRange._min.date?.toISOString().split('T')[0] || null,
          latest: dateRange._max.date?.toISOString().split('T')[0] || null,
        },
      },
      diagnosis: totalRecords === 0 
        ? 'NO_SALES_DATA - Upload CSV reports via Sales > Upload to populate charts'
        : `OK - ${totalRecords} records from ${reportCount} reports`,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
