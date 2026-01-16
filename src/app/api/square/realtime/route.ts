import { NextRequest } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { realSquareService } from '@/services/real-square-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dataType = searchParams.get('type') || 'orders';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const locationId = searchParams.get('locationId');

    console.log(`🔄 Fetching real-time Square data: ${dataType}`);
    
    // Connect to Square API
    const connected = await realSquareService.connect();
    if (!connected) {
      console.log('⚠️  Square API not connected');
      return createErrorResponse('SQUARE_NOT_CONNECTED', 'Square API connection failed', 503);
    }

    let data: any;
    
    switch (dataType) {
      case 'catalog':
        data = await getRealtimeCatalog();
        break;
      case 'locations':
        data = await getRealtimeLocations();
        break;
      case 'orders':
        data = await getRealtimeOrders({ startDate, endDate, locationId });
        break;
      case 'payments':
        data = await getRealtimePayments({ startDate, endDate, locationId });
        break;
      case 'sales-summary':
        data = await getRealtimeSalesSummary({ startDate, endDate, locationId });
        break;
      default:
        return createErrorResponse('INVALID_DATA_TYPE', 'Invalid data type specified', 400);
    }

    return createSuccessResponse(data, 'Real-time Square data retrieved successfully');
  } catch (error) {
    console.error('❌ Real-time Square data error:', error);
    return createErrorResponse('SQUARE_REALTIME_ERROR', 'Failed to fetch real-time Square data', 500);
  }
}

async function getRealtimeCatalog() {
  const items = await realSquareService.getCatalogItems();
  
  return {
    type: 'catalog',
    totalItems: items.length,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category?.name,
      variationsCount: item.variations.length,
      variations: item.variations.map(v => ({
        id: v.id,
        name: v.name,
        price: Number(v.priceMoney.amount) / 100, // Convert cents to dollars
        currency: v.priceMoney.currency
      })),
      lastUpdated: item.updatedAt
    })),
    lastSync: new Date().toISOString()
  };
}

async function getRealtimeLocations() {
  try {
    console.log('🏪 Fetching Square locations...');
    const locations = await realSquareService.getLocations();
    
    return {
      type: 'locations',
      totalLocations: locations.length,
      locations: locations.map(location => ({
        id: location.id,
        name: location.name,
        address: location.address,
        timezone: location.timezone,
        businessName: location.businessName,
        status: location.status,
        capabilities: location.capabilities
      })),
      lastSync: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to fetch locations:', error);
    return {
      type: 'locations',
      totalLocations: 0,
      locations: [],
      lastSync: new Date().toISOString(),
      error: 'Failed to fetch locations'
    };
  }
}

async function getRealtimeOrders(filters: { startDate?: string | null; endDate?: string | null; locationId?: string | null }) {
  const squareFilters: any = {};
  if (filters.startDate) squareFilters.startDate = new Date(filters.startDate);
  if (filters.endDate) squareFilters.endDate = new Date(filters.endDate);
  if (filters.locationId) squareFilters.locationId = filters.locationId;

  console.log('🔍 Searching orders with filters:', squareFilters);
  
  // Fetch ALL orders with pagination
  const allOrders: any[] = [];
  const cursor: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  do {
    const ordersPage = await realSquareService.getAllOrders({ ...squareFilters, cursor, limit: 500 });
    allOrders.push(...ordersPage);
    pageCount++;
    
    // The real Square service handles pagination internally
    break;
  } while (cursor && pageCount < maxPages);
  
  console.log(`📦 Found ${allOrders.length} orders from Square API (${pageCount} pages)`);
  
  return {
    type: 'orders',
    totalOrders: allOrders.length,
    orders: allOrders.map(order => ({
      id: order.id,
      locationId: order.locationId,
      source: order.orderSource.name,
      totalAmount: Number(order.totalMoney.amount) / 100,
      totalTax: order.totalTaxMoney ? Number(order.totalTaxMoney.amount) / 100 : 0,
      currency: order.totalMoney.currency,
      itemsCount: order.lineItems.length,
      items: order.lineItems.map(item => ({
        name: item.name,
        quantity: parseFloat(item.quantity),
        amount: Number(item.totalMoney.amount) / 100,
        catalogId: item.catalogObjectId,
        variationName: item.variationName
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    })),
    lastSync: new Date().toISOString()
  };
}

async function getRealtimePayments(filters: { startDate?: string | null; endDate?: string | null; locationId?: string | null }) {
  const squareFilters: any = {};
  if (filters.startDate) squareFilters.startDate = new Date(filters.startDate);
  if (filters.endDate) squareFilters.endDate = new Date(filters.endDate);
  if (filters.locationId) squareFilters.locationId = filters.locationId;

  console.log('💳 Searching payments with filters:', squareFilters);
  
  // Fetch ALL payments with pagination
  const allPayments: any[] = [];
  const cursor: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  do {
    const paymentsPage = await realSquareService.getAllPayments({ ...squareFilters, cursor, limit: 500 });
    allPayments.push(...paymentsPage);
    pageCount++;
    
    // The real Square service handles pagination internally
    break;
  } while (cursor && pageCount < maxPages);
  
  console.log(`💰 Found ${allPayments.length} payments from Square API (${pageCount} pages)`);
  
  const totalAmount = allPayments.reduce((sum, payment) => sum + (Number(payment.totalMoney.amount) / 100), 0);
  const completedPayments = allPayments.filter(p => p.status === 'COMPLETED');
  
  return {
    type: 'payments',
    totalPayments: allPayments.length,
    completedPayments: completedPayments.length,
    totalAmount: totalAmount,
    totalCompletedAmount: completedPayments.reduce((sum, payment) => sum + (Number(payment.totalMoney.amount) / 100), 0),
    payments: allPayments.map(payment => ({
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.totalMoney.amount) / 100,
      currency: payment.totalMoney.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    })),
    lastSync: new Date().toISOString()
  };
}

async function getRealtimeSalesSummary(filters: { startDate?: string | null; endDate?: string | null; locationId?: string | null }) {
  // Get both orders and payments for comprehensive summary
  const [ordersData, paymentsData] = await Promise.all([
    getRealtimeOrders(filters),
    getRealtimePayments(filters)
  ]);

  // Aggregate sales data
  const itemSales = new Map<string, { quantity: number; revenue: number; orders: number }>();
  const categorySales = new Map<string, { quantity: number; revenue: number; orders: number }>();
  
  ordersData.orders.forEach(order => {
    order.items.forEach(item => {
      const existing = itemSales.get(item.name) || { quantity: 0, revenue: 0, orders: 0 };
      itemSales.set(item.name, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + item.amount,
        orders: existing.orders + 1
      });

      // For categories, we'd need to map items to categories
      // For now, use a generic category
      const category = 'Square Sales';
      const catExisting = categorySales.get(category) || { quantity: 0, revenue: 0, orders: 0 };
      categorySales.set(category, {
        quantity: catExisting.quantity + item.quantity,
        revenue: catExisting.revenue + item.amount,
        orders: catExisting.orders + 1
      });
    });
  });

  // Convert to arrays and sort
  const topItems = Array.from(itemSales.entries())
    .map(([name, data]) => ({ itemName: name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topCategories = Array.from(categorySales.entries())
    .map(([name, data]) => ({ category: name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = paymentsData.totalCompletedAmount;
  const totalQuantity = topItems.reduce((sum, item) => sum + item.quantity, 0);

  console.log(`📊 Square Sales Summary: ${ordersData.totalOrders} orders, $${totalRevenue.toFixed(2)} revenue, ${totalQuantity} items`);
  console.log(`📊 Top items count: ${topItems.length}, Top categories: ${topCategories.length}`);

  return {
    type: 'sales-summary',
    overview: {
      totalRevenue: totalRevenue,
      totalQuantity: totalQuantity,
      totalOrders: ordersData.totalOrders,
      totalPayments: paymentsData.completedPayments,
      dateRange: {
        start: filters.startDate,
        end: filters.endDate
      }
    },
    topItems: topItems.map(item => ({
      ...item,
      percentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
    })),
    topCategories: topCategories.map(cat => ({
      ...cat,
      percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0
    })),
    realtimeMetrics: {
      averageOrderValue: ordersData.totalOrders > 0 ? totalRevenue / ordersData.totalOrders : 0,
      itemsPerOrder: ordersData.totalOrders > 0 ? totalQuantity / ordersData.totalOrders : 0,
      paymentSuccessRate: paymentsData.totalPayments > 0 ? (paymentsData.completedPayments / paymentsData.totalPayments) * 100 : 0
    },
    lastSync: new Date().toISOString()
  };
}

