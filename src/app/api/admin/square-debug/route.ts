import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { realSquareService } from '@/services/real-square-service';

const SYNC_SECRET = process.env.CRON_SECRET || 'wild-octave-sync-2024';

/**
 * Debug endpoint to check raw Square API responses
 */
export async function GET(request: NextRequest) {
  const providedKey = request.nextUrl.searchParams.get('key');
  if (providedKey !== SYNC_SECRET) {
    return createErrorResponse('UNAUTHORIZED', 'Invalid key', 401);
  }

  try {
    // Test connection
    const connected = await realSquareService.connect();
    
    // Get locations
    const locations = await realSquareService.getLocations();
    
    // Get vendors
    const vendors = await realSquareService.getVendors();
    
    // Get first 10 catalog items
    const catalogItems = await realSquareService.getCatalogItems();
    
    return createSuccessResponse({
      connected,
      locations: locations.slice(0, 5),
      vendorCount: vendors.length,
      vendors: vendors.slice(0, 10),
      catalogItemCount: catalogItems.length,
      sampleItems: catalogItems.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name,
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        variations: item.variations.map(v => ({
          id: v.id,
          name: v.name,
          sellPrice: v.priceMoney?.amount ? v.priceMoney.amount / 100 : null,
          costPrice: v.costMoney?.amount ? v.costMoney.amount / 100 : null,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Square debug error:', error);
    return createErrorResponse('DEBUG_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
