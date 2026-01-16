import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { squareService } from '@/services/square-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting Square data sync...');
    
    // Connect to Square MCP
    const connected = await squareService.connect();
    if (!connected) {
      return createErrorResponse('SQUARE_CONNECTION_ERROR', 'Failed to connect to Square API', 500);
    }

    const body = await request.json();
    const { syncType = 'orders', startDate, endDate, locationId } = body;

    let syncResults: any = {};

    switch (syncType) {
      case 'catalog':
        syncResults = await syncCatalogItems();
        break;
      case 'orders':
        syncResults = await syncOrders({ startDate, endDate, locationId });
        break;
      case 'payments':
        syncResults = await syncPayments({ startDate, endDate, locationId });
        break;
      case 'full':
        const catalogSync = await syncCatalogItems();
        const ordersSync = await syncOrders({ startDate, endDate, locationId });
        const paymentsSync = await syncPayments({ startDate, endDate, locationId });
        
        syncResults = {
          catalog: catalogSync,
          orders: ordersSync,
          payments: paymentsSync
        };
        break;
      default:
        return createErrorResponse('INVALID_SYNC_TYPE', 'Invalid sync type specified', 400);
    }

    console.log('✅ Square sync completed:', syncResults);

    return createSuccessResponse(syncResults, 'Square data synced successfully');
  } catch (error) {
    console.error('❌ Square sync error:', error);
    return createErrorResponse('SQUARE_SYNC_ERROR', 'Failed to sync Square data', 500);
  } finally {
    // Optionally disconnect after sync
    // await squareService.disconnect();
  }
}

async function syncCatalogItems() {
  try {
    console.log('📦 Syncing catalog items...');
    
    const squareItems = await squareService.getCatalogItems();
    let updatedCount = 0;
    let createdCount = 0;

    for (const squareItem of squareItems) {
      for (const variation of squareItem.variations) {
        const itemData = {
          name: `${squareItem.name} - ${variation.name}`,
          category: squareItem.category?.name || 'Uncategorized',
          currentCostExGst: variation.priceMoney.amount / 100, // Convert cents to dollars
          currentMarkup: 1.0, // Default markup
          currentSellExGst: variation.priceMoney.amount / 100,
          currentSellIncGst: (variation.priceMoney.amount / 100) * 1.1, // Assume 10% GST
          sku: `SQ_${variation.id}`,
        };

        const existingItem = await prisma.item.findUnique({
          where: { sku: itemData.sku }
        });

        if (existingItem) {
          await prisma.item.update({
            where: { id: existingItem.id },
            data: itemData
          });
          updatedCount++;
        } else {
          await prisma.item.create({
            data: itemData
          });
          createdCount++;
        }
      }
    }

    return { 
      type: 'catalog',
      itemsProcessed: squareItems.length,
      created: createdCount,
      updated: updatedCount
    };
  } catch (error) {
    console.error('❌ Catalog sync error:', error);
    throw error;
  }
}

async function syncOrders(filters: { startDate?: string; endDate?: string; locationId?: string }) {
  try {
    console.log('🛒 Syncing orders...');
    
    const squareFilters: any = {};
    if (filters.startDate) squareFilters.startDate = new Date(filters.startDate);
    if (filters.endDate) squareFilters.endDate = new Date(filters.endDate);
    if (filters.locationId) squareFilters.locationId = filters.locationId;

    const squareOrders = await squareService.searchOrders(squareFilters);
    let processedCount = 0;

    for (const order of squareOrders) {
      // Convert Square order data to sales aggregates
      for (const lineItem of order.lineItems) {
        const salesData = {
          date: new Date(order.createdAt),
          category: 'Square Sales', // We could map this to actual categories
          itemName: lineItem.name,
          revenue: lineItem.totalMoney.amount / 100, // Convert cents to dollars
          quantity: parseFloat(lineItem.quantity),
          margin: null, // Calculate if we have cost data
        };

        // Use upsert to handle duplicates
        await prisma.salesAggregate.upsert({
          where: {
            date_category_itemName: {
              date: salesData.date,
              category: salesData.category,
              itemName: salesData.itemName,
            }
          },
          update: {
            revenue: { increment: salesData.revenue },
            quantity: { increment: salesData.quantity },
          },
          create: salesData
        });
      }
      processedCount++;
    }

    return {
      type: 'orders',
      ordersProcessed: processedCount,
      lineItemsProcessed: squareOrders.reduce((sum, order) => sum + order.lineItems.length, 0)
    };
  } catch (error) {
    console.error('❌ Orders sync error:', error);
    throw error;
  }
}

async function syncPayments(filters: { startDate?: string; endDate?: string; locationId?: string }) {
  try {
    console.log('💳 Syncing payments...');
    
    const squareFilters: any = {};
    if (filters.startDate) squareFilters.startDate = new Date(filters.startDate);
    if (filters.endDate) squareFilters.endDate = new Date(filters.endDate);
    if (filters.locationId) squareFilters.locationId = filters.locationId;

    const squarePayments = await squareService.getPayments(squareFilters);
    let processedCount = 0;

    // Store payment data for financial reporting
    for (const payment of squarePayments) {
      // This could be stored in a payments table if needed
      // For now, we'll just count them
      processedCount++;
    }

    return {
      type: 'payments',
      paymentsProcessed: processedCount,
      totalAmount: squarePayments.reduce((sum, payment) => sum + (payment.totalMoney.amount / 100), 0)
    };
  } catch (error) {
    console.error('❌ Payments sync error:', error);
    throw error;
  }
}

