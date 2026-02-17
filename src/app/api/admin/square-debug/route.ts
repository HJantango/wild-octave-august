import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { SquareClient, SquareEnvironment } from 'square';

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
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const environment = process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

    if (!accessToken) {
      return createErrorResponse('CONFIG_ERROR', 'SQUARE_ACCESS_TOKEN not set', 500);
    }

    const client = new SquareClient({
      token: accessToken,
      environment
    });

    // Test locations
    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    // Test vendors - raw response
    let vendorsRawResult: any = null;
    let vendorsError: string | null = null;
    try {
      const vendorsResponse = await client.vendors.search({
        filter: { status: ['ACTIVE'] }
      });
      vendorsRawResult = vendorsResponse.result;
    } catch (e: any) {
      vendorsError = e.message;
    }

    // Test catalog - raw response
    let catalogRawResult: any = null;
    let catalogError: string | null = null;
    try {
      const catalogResponse = await client.catalog.list({ types: 'ITEM' });
      // The response might be a paginated iterator - let's handle both cases
      if (catalogResponse.result?.objects) {
        catalogRawResult = {
          objectCount: catalogResponse.result.objects.length,
          firstFiveNames: catalogResponse.result.objects.slice(0, 5).map((o: any) => o.itemData?.name),
          cursor: catalogResponse.result.cursor,
        };
      } else if (catalogResponse.objects) {
        catalogRawResult = {
          objectCount: catalogResponse.objects.length,
          firstFiveNames: catalogResponse.objects.slice(0, 5).map((o: any) => o.itemData?.name),
        };
      } else {
        // Try iterating if it's a paginated response
        const items: any[] = [];
        let count = 0;
        if (catalogResponse[Symbol.asyncIterator]) {
          for await (const item of catalogResponse) {
            if (count < 5) items.push(item.itemData?.name);
            count++;
          }
          catalogRawResult = {
            objectCount: count,
            firstFiveNames: items,
            note: 'Iterated through async response',
          };
        } else {
          catalogRawResult = {
            rawKeys: Object.keys(catalogResponse),
            hasResult: 'result' in catalogResponse,
            hasObjects: 'objects' in catalogResponse,
          };
        }
      }
    } catch (e: any) {
      catalogError = e.message + '\n' + e.stack;
    }

    return createSuccessResponse({
      env: environment,
      tokenPrefix: accessToken.substring(0, 8) + '...',
      locationCount: locations.length,
      locations: locations.slice(0, 3).map(l => ({ id: l.id, name: l.name, status: l.status })),
      vendorsRaw: vendorsRawResult,
      vendorsError,
      catalogRaw: catalogRawResult,
      catalogError,
    });
  } catch (error: any) {
    console.error('Square debug error:', error);
    return createErrorResponse('DEBUG_ERROR', error.message, 500);
  }
}

export const dynamic = 'force-dynamic';
