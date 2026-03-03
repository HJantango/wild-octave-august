import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || 'cake';

    const client = getSquareClient();
    
    // Get all vendors
    const vendorsResponse: any = await client.catalog.list({ types: 'VENDOR' });
    const vendors = vendorsResponse.result?.objects || vendorsResponse.objects || [];
    const vendorMap = new Map<string, string>();
    for (const vendor of vendors) {
      if (vendor.id && vendor.vendorData?.name) {
        vendorMap.set(vendor.id, vendor.vendorData.name);
      }
    }

    // Get items matching search
    const itemsResponse: any = await client.catalog.search({
      objectTypes: ['ITEM'],
      query: {
        textQuery: {
          keywords: [search],
        },
      },
      limit: 100,
    });
    
    const items = itemsResponse.result?.objects || itemsResponse.objects || [];
    
    const results: any[] = [];
    
    for (const item of items) {
      const itemData = item.itemData;
      if (!itemData) continue;
      
      for (const variation of itemData.variations || []) {
        const variationData = variation.itemVariationData;
        const vendorInfos = variationData?.itemVariationVendorInfos || [];
        const vendorId = vendorInfos[0]?.vendorId;
        const vendorName = vendorId ? vendorMap.get(vendorId) : null;
        
        results.push({
          itemName: itemData.name,
          variationName: variationData?.name || 'Regular',
          variationId: variation.id,
          hasVendor: !!vendorId,
          vendorId: vendorId || null,
          vendorName: vendorName || null,
        });
      }
    }
    
    // Group by vendor
    const byVendor: Record<string, any[]> = {};
    for (const r of results) {
      const v = r.vendorName || 'NO_VENDOR';
      if (!byVendor[v]) byVendor[v] = [];
      byVendor[v].push(r);
    }

    return createSuccessResponse({
      search,
      totalItems: results.length,
      vendors: Array.from(vendorMap.entries()).map(([id, name]) => ({ id, name })),
      byVendor,
      results,
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return createErrorResponse('DEBUG_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
