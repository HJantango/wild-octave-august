import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Get sales data from last 30 days to find missing vendors
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get unique items from recent sales
    const recentSales = await prisma.squareDailySales.findMany({
      where: { 
        date: { gte: thirtyDaysAgo },
        quantitySold: { gt: 0 }
      },
      select: {
        itemName: true,
        vendorName: true,
        squareCatalogId: true,
      },
      distinct: ['itemName'],
    });

    // Get all vendors in database
    const allVendors = await prisma.vendor.findMany({
      select: { id: true, name: true },
    });
    const vendorNames = new Set(allVendors.map(v => v.name.toLowerCase()));

    // Get all items with vendor assignments
    const itemsWithVendors = await prisma.item.findMany({
      select: {
        name: true,
        squareCatalogId: true,
        vendor: { select: { name: true } },
      },
      where: {
        vendorId: { not: null },
      },
    });
    
    const itemVendorMap = new Map(
      itemsWithVendors.map(item => [item.name.toLowerCase().trim(), item.vendor?.name])
    );

    // Analyze coverage
    const missingVendorItems: Array<{
      itemName: string;
      salesVendor: string | null;
      dbVendor: string | null;
      hasSquareId: boolean;
      vendorExists: boolean;
    }> = [];
    
    const unknownVendors = new Set<string>();
    
    for (const sale of recentSales) {
      const dbVendor = itemVendorMap.get(sale.itemName.toLowerCase().trim());
      const salesVendor = sale.vendorName;
      
      if (salesVendor && !vendorNames.has(salesVendor.toLowerCase())) {
        unknownVendors.add(salesVendor);
      }
      
      if (!dbVendor || dbVendor === 'Unknown') {
        missingVendorItems.push({
          itemName: sale.itemName,
          salesVendor: salesVendor,
          dbVendor: dbVendor || null,
          hasSquareId: !!sale.squareCatalogId,
          vendorExists: salesVendor ? vendorNames.has(salesVendor.toLowerCase()) : false,
        });
      }
    }

    // Get some sample "Heaps Good" items specifically
    const heapsGoodItems = recentSales.filter(s => 
      s.itemName.toLowerCase().includes('heaps good') || 
      s.vendorName?.toLowerCase().includes('heaps good')
    );

    return createSuccessResponse({
      summary: {
        totalSalesItems: recentSales.length,
        itemsWithVendors: itemsWithVendors.length,
        missingVendorItems: missingVendorItems.length,
        unknownVendorCount: unknownVendors.size,
        heapsGoodSamples: heapsGoodItems.length,
      },
      unknownVendors: Array.from(unknownVendors),
      missingVendorItems: missingVendorItems.slice(0, 20),
      heapsGoodSamples: heapsGoodItems.slice(0, 5),
      allVendors: allVendors.map(v => v.name),
    });

  } catch (error: any) {
    return createSuccessResponse({
      error: error.message,
      diagnosis: "Database query failed",
    });
  }
}

export const dynamic = 'force-dynamic';