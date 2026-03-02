import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'analyze';

    // Get recent sales data to find items missing vendor assignments
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (action === 'analyze') {
      // Just analyze what needs fixing
      const salesWithUnknownVendors = await prisma.squareDailySales.findMany({
        where: {
          date: { gte: thirtyDaysAgo },
          vendorName: { not: null },
        },
        select: {
          itemName: true,
          vendorName: true,
          squareCatalogId: true,
        },
        distinct: ['itemName', 'vendorName'],
      });

      const itemsNeedingVendors = await prisma.item.findMany({
        where: {
          OR: salesWithUnknownVendors.map(sale => ({
            OR: [
              { name: sale.itemName },
              sale.squareCatalogId ? { squareCatalogId: sale.squareCatalogId } : { name: sale.itemName }
            ]
          }))
        },
        select: {
          id: true,
          name: true,
          squareCatalogId: true,
          vendor: { select: { name: true } }
        }
      });

      const needsFixing = itemsNeedingVendors.filter(item => !item.vendor);
      const heapsGoodItems = needsFixing.filter(item => 
        salesWithUnknownVendors.some(sale => 
          (sale.itemName === item.name || sale.squareCatalogId === item.squareCatalogId) && 
          sale.vendorName?.toLowerCase().includes('heaps good')
        )
      );

      return createSuccessResponse({
        summary: {
          totalSalesItems: salesWithUnknownVendors.length,
          itemsNeedingVendors: needsFixing.length,
          heapsGoodItems: heapsGoodItems.length,
        },
        examples: {
          heapsGoodItems: heapsGoodItems.slice(0, 5),
          salesSamples: salesWithUnknownVendors.filter(s => s.vendorName?.toLowerCase().includes('heaps good')).slice(0, 5),
        },
        message: 'Use action: "fix" to automatically assign vendors to items based on sales data'
      });
    }

    if (action === 'fix') {
      // Actually fix the vendor assignments
      let fixedCount = 0;
      let vendorsCreated = 0;

      // Get sales data with vendor info  
      const salesWithVendors = await prisma.squareDailySales.findMany({
        where: {
          date: { gte: thirtyDaysAgo },
          vendorName: { not: null },
        },
        select: {
          itemName: true,
          vendorName: true,
          squareCatalogId: true,
        },
        distinct: ['itemName', 'vendorName'],
      });

      console.log(`📦 Found ${salesWithVendors.length} sales records with vendor data`);

      // Group by vendor name
      const vendorGroups = new Map<string, Array<{itemName: string, squareCatalogId: string | null}>>();
      for (const sale of salesWithVendors) {
        if (!sale.vendorName) continue;
        
        if (!vendorGroups.has(sale.vendorName)) {
          vendorGroups.set(sale.vendorName, []);
        }
        vendorGroups.get(sale.vendorName)!.push({
          itemName: sale.itemName,
          squareCatalogId: sale.squareCatalogId,
        });
      }

      console.log(`📦 Found ${vendorGroups.size} unique vendors in sales data`);

      for (const [vendorName, items] of vendorGroups) {
        // Find or create vendor
        let vendor = await prisma.vendor.findFirst({
          where: { name: { equals: vendorName, mode: 'insensitive' } }
        });

        if (!vendor) {
          vendor = await prisma.vendor.create({
            data: { name: vendorName }
          });
          vendorsCreated++;
          console.log(`✅ Created vendor: ${vendorName}`);
        }

        // Assign vendor to items
        for (const itemInfo of items) {
          // Find item by Square ID first, then by name
          let item = null;
          if (itemInfo.squareCatalogId) {
            item = await prisma.item.findFirst({
              where: { squareCatalogId: itemInfo.squareCatalogId }
            });
          }
          if (!item) {
            item = await prisma.item.findFirst({
              where: { name: { equals: itemInfo.itemName, mode: 'insensitive' } }
            });
          }

          if (item && !item.vendorId) {
            await prisma.item.update({
              where: { id: item.id },
              data: { vendorId: vendor.id }
            });
            fixedCount++;
            console.log(`✅ Assigned ${vendorName} → "${itemInfo.itemName}"`);
          }
        }
      }

      return createSuccessResponse({
        summary: {
          vendorsCreated,
          itemsFixed: fixedCount,
          vendorsProcessed: vendorGroups.size,
        },
        message: `Created ${vendorsCreated} vendors and assigned vendors to ${fixedCount} items`
      });
    }

    return createErrorResponse('INVALID_ACTION', 'Use action: "analyze" or "fix"', 400);
  } catch (error: any) {
    console.error('Vendor assignment error:', error);
    return createErrorResponse('VENDOR_FIX_ERROR', error.message, 500);
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ action: 'analyze' }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';