import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse, validateRequest } from '@/lib/api-utils';
import { rectificationFilterSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = validateRequest(rectificationFilterSchema, searchParams);
    if (!validation.success) {
      return validation.error;
    }

    const { vendorId, resolved, contacted, startDate, endDate, page, limit } = validation.data;

    const where: any = {
      needsRectification: true,
    };

    // Filter by vendor
    if (vendorId) {
      where.vendorId = vendorId;
    }

    // Filter by resolution status
    if (resolved !== undefined) {
      if (resolved) {
        where.rectificationResolvedAt = { not: null };
      } else {
        where.rectificationResolvedAt = null;
      }
    }

    // Filter by contacted status
    if (contacted !== undefined) {
      if (contacted) {
        where.rectificationContactedAt = { not: null };
      } else {
        where.rectificationContactedAt = null;
      }
    }

    // Date range filtering
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = startDate;
      if (endDate) where.invoiceDate.lte = endDate;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, name: true, contactInfo: true },
          },
          lineItems: {
            select: { 
              id: true, 
              name: true, 
              quantity: true, 
              unitCostExGst: true,
            },
          },
        },
        orderBy: [
          { rectificationContactedAt: 'asc' }, // Show uncontacted first
          { invoiceDate: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    // Calculate summary statistics
    const stats = await prisma.invoice.groupBy({
      by: ['vendorId'],
      where,
      _count: {
        id: true,
      },
    });

    const summary = {
      total,
      unresolved: await prisma.invoice.count({
        where: { ...where, rectificationResolvedAt: null },
      }),
      uncontacted: await prisma.invoice.count({
        where: { ...where, rectificationContactedAt: null },
      }),
      byVendor: await Promise.all(
        stats.map(async (stat) => ({
          vendorId: stat.vendorId,
          count: stat._count.id,
          vendor: await prisma.vendor.findUnique({
            where: { id: stat.vendorId },
            select: { name: true },
          }),
        }))
      ),
    };

    return createSuccessResponse({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error('Rectification fetch error:', error);
    return createErrorResponse('RECTIFICATION_FETCH_ERROR', 'Failed to fetch rectification data', 500);
  }
}