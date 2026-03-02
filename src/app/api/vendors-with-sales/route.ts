import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get database vendors
    const dbVendors = await prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get unique vendors from recent sales data (last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const salesVendors = await prisma.squareDailySales.groupBy({
      by: ['vendorName'],
      where: {
        vendorName: { not: null },
        date: { gte: sixtyDaysAgo },
      },
      _count: { vendorName: true },
      orderBy: { vendorName: 'asc' },
    });

    // Combine vendors, prioritizing database vendors but including sales-only vendors
    const vendorMap = new Map<string, { id?: string; name: string; source: string; salesCount?: number }>();

    // Add database vendors first
    for (const vendor of dbVendors) {
      vendorMap.set(vendor.name.toLowerCase(), {
        id: vendor.id,
        name: vendor.name,
        source: 'database',
      });
    }

    // Add sales vendors, marking new ones
    for (const salesVendor of salesVendors) {
      if (!salesVendor.vendorName) continue;
      
      const key = salesVendor.vendorName.toLowerCase();
      const existing = vendorMap.get(key);
      
      if (existing) {
        // Update existing with sales count
        existing.salesCount = salesVendor._count.vendorName;
        existing.source = 'both';
      } else {
        // New vendor from sales only
        vendorMap.set(key, {
          name: salesVendor.vendorName,
          source: 'sales_only',
          salesCount: salesVendor._count.vendorName,
        });
      }
    }

    // Convert to array and sort
    const allVendors = Array.from(vendorMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return createSuccessResponse({
      vendors: allVendors,
      summary: {
        databaseVendors: dbVendors.length,
        salesVendors: salesVendors.length,
        totalUnique: allVendors.length,
        salesOnlyVendors: allVendors.filter(v => v.source === 'sales_only').length,
      }
    });

  } catch (error: any) {
    console.error('Error fetching vendors with sales:', error);
    return createSuccessResponse({
      vendors: [],
      error: error.message,
    });
  }
}

export const dynamic = 'force-dynamic';