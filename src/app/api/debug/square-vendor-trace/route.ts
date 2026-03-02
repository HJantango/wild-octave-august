import { NextRequest } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import { createSuccessResponse } from '@/lib/api-utils';

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
    const client = getSquareClient();
    const results: any = {
      timestamp: new Date().toISOString(),
      steps: [],
      vendors: [],
      catalogItems: [],
      heapsGoodItems: [],
      errors: [],
    };

    // Step 1: Test basic Square connection
    try {
      results.steps.push('Testing Square API connection...');
      const locationsResponse = await client.locations.list();
      results.locations = locationsResponse.result?.locations?.length || 0;
      results.steps.push(`✅ Square API connected - ${results.locations} locations`);
    } catch (error: any) {
      results.errors.push('Square API connection failed: ' + error.message);
      results.steps.push('❌ Square API connection failed');
    }

    // Step 2: Get vendors from Square
    try {
      results.steps.push('Fetching vendors from Square...');
      const vendorsResponse = await client.vendors.search({
        filter: { status: ['ACTIVE'] }
      });
      
      const vendors = vendorsResponse.result?.vendors || [];
      results.vendors = vendors.map((v: any) => ({
        id: v.id,
        name: v.name,
        status: v.status,
      }));
      results.steps.push(`✅ Found ${vendors.length} vendors in Square`);
      
      // Check for Heaps Good vendor specifically
      const heapsGoodVendor = vendors.find((v: any) => 
        v.name?.toLowerCase().includes('heaps good')
      );
      if (heapsGoodVendor) {
        results.steps.push(`🎯 FOUND Heaps Good vendor: "${heapsGoodVendor.name}" (ID: ${heapsGoodVendor.id})`);
        results.heapsGoodVendorId = heapsGoodVendor.id;
      } else {
        results.steps.push(`❌ Heaps Good vendor NOT FOUND in Square vendors`);
      }
    } catch (error: any) {
      results.errors.push('Vendor fetch failed: ' + error.message);
      results.steps.push('❌ Vendor fetch failed');
    }

    // Step 3: Get catalog items and check vendor assignments
    try {
      results.steps.push('Fetching catalog items from Square...');
      const catalogResponse = await client.catalog.list({ types: 'ITEM' });
      
      const catalogObjects: any[] = [];
      if (catalogResponse.result?.objects) {
        catalogObjects.push(...catalogResponse.result.objects);
      }
      
      results.steps.push(`✅ Found ${catalogObjects.length} catalog objects`);
      
      // Build vendor lookup map
      const vendorMap = new Map<string, string>();
      for (const vendor of results.vendors) {
        vendorMap.set(vendor.id, vendor.name);
      }
      
      // Process catalog items and extract vendor info
      for (const obj of catalogObjects.slice(0, 100)) { // Limit to first 100 for testing
        if (obj.type !== 'ITEM') continue;
        
        const itemData = obj.itemData;
        if (!itemData?.variations) continue;
        
        for (const variation of itemData.variations) {
          const varData = variation.itemVariationData;
          const vendorInfos = varData?.itemVariationVendorInfos || [];
          
          if (vendorInfos.length > 0) {
            const vendorInfo = vendorInfos[0];
            const vendorId = vendorInfo.vendorId;
            const vendorName = vendorId ? vendorMap.get(vendorId) : undefined;
            
            const itemInfo = {
              itemId: obj.id,
              itemName: itemData.name,
              variationId: variation.id,
              variationName: varData?.name,
              vendorId: vendorId,
              vendorName: vendorName,
            };
            
            results.catalogItems.push(itemInfo);
            
            // Check for Heaps Good items specifically
            if (itemData.name?.toLowerCase().includes('heaps good') || 
                vendorName?.toLowerCase().includes('heaps good')) {
              results.heapsGoodItems.push(itemInfo);
              results.steps.push(`🥤 HEAPS GOOD ITEM: "${itemData.name}" → vendor: "${vendorName}" (ID: ${vendorId})`);
            }
          }
        }
      }
      
      results.steps.push(`✅ Processed items - ${results.catalogItems.length} have vendors, ${results.heapsGoodItems.length} are Heaps Good`);
      
    } catch (error: any) {
      results.errors.push('Catalog fetch failed: ' + error.message);
      results.steps.push('❌ Catalog fetch failed');
    }

    // Step 4: Check recent orders for vendor data
    try {
      results.steps.push('Checking recent orders for vendor extraction...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const ordersResponse = await client.orders.search({
        locationIds: ['LXREF1GKT3ZMF'], // Your location ID
        query: {
          filter: {
            stateFilter: { states: ['COMPLETED'] },
            dateTimeFilter: {
              createdAt: {
                startAt: yesterday.toISOString(),
                endAt: new Date().toISOString(),
              }
            }
          }
        },
        limit: 10
      });
      
      const orders = ordersResponse.result?.orders || [];
      results.steps.push(`✅ Found ${orders.length} recent orders`);
      
      // Check if orders contain items with vendor info
      let itemsWithVendors = 0;
      let heapsGoodOrderItems = 0;
      
      for (const order of orders.slice(0, 5)) { // Check first 5 orders
        if (!order.lineItems) continue;
        
        for (const lineItem of order.lineItems) {
          const catalogObjectId = lineItem.catalogObjectId;
          if (!catalogObjectId) continue;
          
          // Find this item in our catalog items list
          const catalogItem = results.catalogItems.find((ci: any) => 
            ci.variationId === catalogObjectId
          );
          
          if (catalogItem?.vendorName) {
            itemsWithVendors++;
            
            if (catalogItem.vendorName.toLowerCase().includes('heaps good')) {
              heapsGoodOrderItems++;
              results.steps.push(`🛒 ORDER contains Heaps Good: "${lineItem.name}" → vendor: "${catalogItem.vendorName}"`);
            }
          }
        }
      }
      
      results.steps.push(`✅ Order analysis: ${itemsWithVendors} line items have vendors, ${heapsGoodOrderItems} are Heaps Good`);
      
    } catch (error: any) {
      results.errors.push('Orders fetch failed: ' + error.message);
      results.steps.push('❌ Orders fetch failed');
    }

    return createSuccessResponse(results);

  } catch (error: any) {
    console.error('Square vendor trace error:', error);
    return createSuccessResponse({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export const dynamic = 'force-dynamic';