import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

export async function GET(request: NextRequest) {
  try {
    const client = getSquareClient();
    const LOCATION_ID = 'LXREF1GKT3ZMF';
    
    console.log('🔍 Examining raw Square order data for available fields...');
    
    // Get a recent order to examine the structure
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const searchRequest = {
      locationIds: [LOCATION_ID],
      query: {
        filter: {
          dateTimeFilter: {
            createdAt: {
              startAt: yesterday.toISOString(),
            },
          },
          stateFilter: {
            states: ['COMPLETED'],
          },
        },
      },
      limit: 1,
      returnEntries: false,
    };

    const response: any = await client.orders.searchOrders(searchRequest);
    const orders = response.result?.orders || [];
    
    if (orders.length === 0) {
      return createSuccessResponse({
        message: 'No recent orders found',
        orders: [],
      });
    }
    
    const order = orders[0];
    const lineItem = order.lineItems?.[0];
    
    if (!lineItem) {
      return createSuccessResponse({
        message: 'No line items found',
        orderStructure: Object.keys(order),
      });
    }
    
    // Examine all available fields in the line item
    console.log('📋 Line item fields:', Object.keys(lineItem));
    
    // Also check if we can get catalog item details for reference handle
    let catalogDetails = null;
    if (lineItem.catalogObjectId) {
      try {
        const catalogResponse: any = await client.catalog.retrieveObject(lineItem.catalogObjectId);
        catalogDetails = catalogResponse.result?.object;
        console.log('📚 Catalog object fields:', catalogDetails ? Object.keys(catalogDetails) : 'None');
      } catch (err) {
        console.log('❌ Could not fetch catalog details:', err);
      }
    }

    return createSuccessResponse({
      sampleOrder: {
        orderId: order.id,
        createdAt: order.createdAt,
      },
      lineItemFields: Object.keys(lineItem),
      lineItemSample: {
        name: lineItem.name,
        catalogObjectId: lineItem.catalogObjectId,
        variationName: lineItem.variationName,
        quantity: lineItem.quantity,
        // Show any other interesting fields
        ...Object.fromEntries(
          Object.entries(lineItem)
            .filter(([key, value]) => 
              !['name', 'catalogObjectId', 'variationName', 'quantity'].includes(key) && 
              value !== null && value !== undefined
            )
            .slice(0, 10) // Limit to avoid huge response
        ),
      },
      catalogDetails: catalogDetails ? {
        id: catalogDetails.id,
        type: catalogDetails.type,
        fields: Object.keys(catalogDetails),
        // Check if it has a reference handle or similar field
        potentialReferenceFields: Object.fromEntries(
          Object.entries(catalogDetails)
            .filter(([key, value]) => 
              typeof value === 'string' && 
              (key.toLowerCase().includes('reference') || 
               key.toLowerCase().includes('handle') || 
               key.toLowerCase().includes('sku') ||
               value?.toString().startsWith('#'))
            )
        ),
      } : null,
    });

  } catch (error) {
    console.error('❌ Square field examination error:', error);
    return createErrorResponse(
      'EXAMINATION_ERROR',
      `Failed to examine Square order fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';