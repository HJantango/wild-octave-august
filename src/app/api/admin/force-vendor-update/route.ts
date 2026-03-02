import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'analyze';

    if (action === 'analyze') {
      // Find sales records that should have vendors but don't
      const missingVendorSales = await prisma.squareDailySales.findMany({
        where: {
          vendorName: null,
          date: { gte: new Date('2025-01-01') },
        },
        select: {
          itemName: true,
          squareCatalogId: true,
        },
        distinct: ['itemName'],
        take: 100,
      });

      // Look for obvious vendor patterns in item names
      const vendorPatterns = [
        { pattern: 'heaps good', vendor: 'Heaps Good' },
        { pattern: 'honest sea', vendor: 'Honest Sea' },
        { pattern: 'noosa basics', vendor: 'Noosa Basics' },
        { pattern: 'weleda', vendor: 'Weleda' },
        { pattern: 'ere perez', vendor: 'Ere Perez' },
        { pattern: 'ceres organic', vendor: 'Ceres Organic' },
        { pattern: 'mindful foods', vendor: 'Mindful Foods' },
      ];

      const matches = [];
      for (const sale of missingVendorSales) {
        for (const pattern of vendorPatterns) {
          if (sale.itemName.toLowerCase().includes(pattern.pattern)) {
            matches.push({
              itemName: sale.itemName,
              suggestedVendor: pattern.vendor,
              squareCatalogId: sale.squareCatalogId,
            });
            break;
          }
        }
      }

      return createSuccessResponse({
        totalMissingVendors: missingVendorSales.length,
        patternMatches: matches,
        heapsGoodMatches: matches.filter(m => m.suggestedVendor === 'Heaps Good'),
        message: `Found ${matches.length} items that can be auto-assigned vendors`,
      });
    }

    if (action === 'fix-patterns') {
      // Auto-assign vendors based on item name patterns
      const vendorPatterns = [
        { pattern: 'heaps good', vendor: 'Heaps Good' },
        { pattern: 'honest sea', vendor: 'Honest Sea' },
        { pattern: 'noosa basics', vendor: 'Noosa Basics' },
        { pattern: 'weleda', vendor: 'Weleda' },
        { pattern: 'ere perez', vendor: 'Ere Perez' },
        { pattern: 'ceres organic', vendor: 'Ceres Organic' },
        { pattern: 'mindful foods', vendor: 'Mindful Foods' },
        { pattern: 'thursday plantation', vendor: 'Thursday Plantation' },
        { pattern: 'dr. bronner', vendor: 'Dr. Bronners' },
        { pattern: 'mungalli', vendor: 'Mungalli' },
        { pattern: 'kehoe', vendor: 'Kehoes' },
        { pattern: 'nutty bruce', vendor: 'Nutty Bruce' },
        { pattern: 'daylesford', vendor: 'Daylesford' },
      ];

      let updatedCount = 0;
      const updates = [];

      for (const pattern of vendorPatterns) {
        // Update sales records where vendorName is null but item name matches pattern
        const result = await prisma.squareDailySales.updateMany({
          where: {
            vendorName: null,
            itemName: { contains: pattern.pattern, mode: 'insensitive' },
          },
          data: {
            vendorName: pattern.vendor,
          },
        });

        if (result.count > 0) {
          updatedCount += result.count;
          updates.push({
            pattern: pattern.pattern,
            vendor: pattern.vendor,
            recordsUpdated: result.count,
          });
          console.log(`✅ Updated ${result.count} records: "${pattern.pattern}" → "${pattern.vendor}"`);
        }
      }

      return createSuccessResponse({
        totalUpdated: updatedCount,
        updates: updates,
        heapsGoodUpdate: updates.find(u => u.vendor === 'Heaps Good'),
        message: `Updated ${updatedCount} sales records with vendor assignments`,
      });
    }

    return createErrorResponse('INVALID_ACTION', 'Use action: "analyze" or "fix-patterns"', 400);
  } catch (error: any) {
    console.error('Force vendor update error:', error);
    return createErrorResponse('VENDOR_UPDATE_ERROR', error.message, 500);
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { 
    method: 'POST', 
    body: JSON.stringify({ action: 'analyze' }) 
  }) as NextRequest);
}

export const dynamic = 'force-dynamic';