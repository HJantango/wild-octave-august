import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get all unique categories from the database
    const categories = await prisma.squareDailySales.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      where: {
        category: { not: null },
      },
      orderBy: {
        category: 'asc',
      },
    });

    // Also get sample vendor names
    const vendors = await prisma.squareDailySales.findMany({
      select: {
        vendorName: true,
      },
      distinct: ['vendorName'],
      where: {
        vendorName: { not: null },
      },
      orderBy: {
        vendorName: 'asc',
      },
    });

    // Get total count
    const totalRecords = await prisma.squareDailySales.count();

    // Get date range
    const dateRange = await prisma.squareDailySales.aggregate({
      _min: { date: true },
      _max: { date: true },
    });

    return createSuccessResponse({
      categories: categories.map(c => c.category).filter(Boolean),
      vendors: vendors.map(v => v.vendorName).filter(Boolean),
      totalRecords,
      dateRange: {
        min: dateRange._min.date,
        max: dateRange._max.date,
      },
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return createErrorResponse('FETCH_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
