import { SquareClient, SquareEnvironment } from 'square';

export interface SquareItem {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  };
  variations: Array<{
    id: string;
    name: string;
    priceMoney: {
      amount: number;
      currency: string;
    };
  }>;
  updatedAt: string;
  createdAt: string;
}

export interface SquareOrder {
  id: string;
  locationId: string;
  orderSource: {
    name: string;
  };
  lineItems: Array<{
    catalogObjectId?: string;
    variationName?: string;
    name: string;
    quantity: string;
    totalMoney: {
      amount: number;
      currency: string;
    };
    totalTaxMoney?: {
      amount: number;
      currency: string;
    };
  }>;
  totalMoney: {
    amount: number;
    currency: string;
  };
  totalTaxMoney?: {
    amount: number;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SquarePayment {
  id: string;
  createdAt: string;
  updatedAt: string;
  amountMoney: {
    amount: number;
    currency: string;
  };
  totalMoney: {
    amount: number;
    currency: string;
  };
  orderId?: string;
  status: string;
}

export interface SquareLocation {
  id: string;
  name: string;
  address?: any;
  timezone?: string;
  businessName?: string;
  status: string;
  capabilities?: string[];
}

export interface SquareSalesFilters {
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
  limit?: number;
  cursor?: string;
}

class RealSquareService {
  private client: SquareClient | null = null;
  private isInitialized = false;

  constructor() {
    // Don't initialize here - defer until connect() is called
    // This prevents accessing env vars at module import time
  }

  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const environment = process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

    if (!accessToken) {
      throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
    }

    this.client = new SquareClient({
      token: accessToken,
      environment
    });

    this.isInitialized = true;
    console.log(`🟢 Square API initialized for ${environment} environment`);
  }

  private getClient(): SquareClient {
    if (!this.client) {
      this.initialize();
    }
    if (!this.client) {
      throw new Error('Square client initialization failed');
    }
    return this.client;
  }

  async connect(): Promise<boolean> {
    try {
      // Test connection by fetching locations
      const client = this.getClient();
      const response = await client.locations.list();
      
      if (response.locations && response.locations.length > 0) {
        console.log(`✅ Connected to Square API - Found ${response.locations.length} location(s)`);
        return true;
      }
      
      console.log('⚠️  Square API connected but no locations found');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Square API:', error);
      return false;
    }
  }

  async getLocations(): Promise<SquareLocation[]> {
    try {
      const client = this.getClient();
      const response = await client.locations.list();
      
      return response.locations?.map(location => ({
        id: location.id!,
        name: location.name || 'Unknown Location',
        address: location.address,
        timezone: location.timezone,
        businessName: location.businessName,
        status: location.status!,
        capabilities: location.capabilities
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get Square locations:', error);
      return [];
    }
  }

  async getCatalogItems(filters?: { types?: string[]; categoryId?: string }): Promise<SquareItem[]> {
    try {
      const client = this.getClient();
      const response = await client.catalog.list({
        types: filters?.types?.join(',') || 'ITEM'
      });
      
      return response.result.objects?.filter(obj => obj.type === 'ITEM').map(obj => {
        const itemData = obj.itemData;
        return {
          id: obj.id!,
          name: itemData?.name || 'Unknown Item',
          category: itemData?.categoryId ? {
            id: itemData.categoryId,
            name: 'Unknown Category' // Would need separate call to get category name
          } : undefined,
          variations: itemData?.variations?.map(variation => ({
            id: variation.id!,
            name: variation.itemVariationData?.name || 'Default',
            priceMoney: {
              amount: Number(variation.itemVariationData?.priceMoney?.amount || 0),
              currency: variation.itemVariationData?.priceMoney?.currency || 'AUD'
            }
          })) || [],
          updatedAt: obj.updatedAt!,
          createdAt: obj.createdAt!,
        };
      }) || [];
    } catch (error) {
      console.error('❌ Failed to get catalog items:', error);
      return [];
    }
  }

  async searchOrders(filters: SquareSalesFilters = {}): Promise<SquareOrder[]> {
    try {
      const client = this.getClient();

      // Build search query
      const searchQuery: any = {
        filter: {}
      };

      // Always use recent date filter to avoid huge datasets causing timeouts
      const defaultStartDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Last year by default
      const endDate = filters.endDate || new Date();
      
      searchQuery.filter.dateTimeFilter = {
        createdAt: {
          startAt: defaultStartDate.toISOString(),
          endAt: endDate.toISOString()
        }
      };

      // Get active locations for the request
      const locations = await this.getLocations();
      const activeLocations = locations.filter(loc => loc.status === 'ACTIVE');
      
      const requestBody = {
        locationIds: filters.locationId ? [filters.locationId] : activeLocations.map(loc => loc.id),
        query: searchQuery,
        limit: Math.min(filters.limit || 50, 50), // Smaller limit to prevent timeouts
        cursor: filters.cursor,
        returnEntries: true
      };

      console.log('🔍 Searching Square orders (last year, limit 50) with:', JSON.stringify(requestBody, null, 2));
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
      );
      
      const response = await Promise.race([
        client.orders.search(requestBody),
        timeoutPromise
      ]);
      
      const orders = response.result?.orders || response.orders || [];
      console.log(`📦 Found ${orders.length} orders from Square API`);
      
      return orders.map(order => ({
        id: order.id!,
        locationId: order.locationId!,
        orderSource: {
          name: order.source?.name || 'Unknown'
        },
        lineItems: order.lineItems?.map(item => ({
          catalogObjectId: item.catalogObjectId,
          variationName: item.variationName,
          name: item.name || 'Unknown Item',
          quantity: item.quantity!,
          totalMoney: {
            amount: Number(item.totalMoney?.amount || 0),
            currency: item.totalMoney?.currency || 'AUD'
          },
          totalTaxMoney: item.totalTaxMoney ? {
            amount: Number(item.totalTaxMoney.amount || 0),
            currency: item.totalTaxMoney.currency || 'AUD'
          } : undefined
        })) || [],
        totalMoney: {
          amount: Number(order.totalMoney?.amount || 0),
          currency: order.totalMoney?.currency || 'AUD'
        },
        totalTaxMoney: order.totalTaxMoney ? {
          amount: Number(order.totalTaxMoney.amount || 0),
          currency: order.totalTaxMoney.currency || 'AUD'
        } : undefined,
        createdAt: order.createdAt!,
        updatedAt: order.updatedAt!,
      })) || [];
    } catch (error) {
      console.error('❌ Failed to search Square orders:', error);
      return [];
    }
  }

  async getPayments(filters: SquareSalesFilters = {}): Promise<SquarePayment[]> {
    try {
      const client = this.getClient();

      // Get active locations for the request
      const locations = await this.getLocations();
      const activeLocations = locations.filter(loc => loc.status === 'ACTIVE');
      
      const requestParams: any = {
        limit: Math.min(filters.limit || 50, 50) // Smaller limit to prevent timeouts
      };

      // Always use recent date filter to avoid huge datasets  
      const defaultStartDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Last year
      const endDate = filters.endDate || new Date();
      
      requestParams.beginTime = defaultStartDate.toISOString();
      requestParams.endTime = endDate.toISOString();
      // Use first active location if no specific location provided
      if (filters.locationId) {
        requestParams.locationId = filters.locationId;
      } else if (activeLocations.length > 0) {
        requestParams.locationId = activeLocations[0].id;
      }
      if (filters.cursor) {
        requestParams.cursor = filters.cursor;
      }

      console.log('💳 Searching Square payments (last year, limit 50) with:', requestParams);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Payment request timeout after 15 seconds')), 15000)
      );
      
      const response = await Promise.race([
        client.payments.list(requestParams),
        timeoutPromise
      ]);
      
      // Handle paginated response correctly  
      const payments = [];
      
      // If it's a paginated response, iterate through pages
      if (response[Symbol.asyncIterator]) {
        for await (const payment of response) {
          payments.push(payment);
        }
      } else if (response.result?.payments) {
        // Handle direct result
        payments.push(...response.result.payments);
      }
      
      console.log(`💰 Found ${payments.length} payments from Square API`);
      
      return payments.map(payment => ({
        id: payment.id!,
        createdAt: payment.createdAt!,
        updatedAt: payment.updatedAt!,
        amountMoney: {
          amount: Number(payment.amountMoney?.amount || 0),
          currency: payment.amountMoney?.currency || 'AUD'
        },
        totalMoney: {
          amount: Number(payment.totalMoney?.amount || 0),
          currency: payment.totalMoney?.currency || 'AUD'
        },
        orderId: payment.orderId,
        status: payment.status!,
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get Square payments:', error);
      return [];
    }
  }

  // Helper method to get all orders across all pages
  async getAllOrders(filters: SquareSalesFilters = {}): Promise<SquareOrder[]> {
    const allOrders: SquareOrder[] = [];
    let cursor: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = 50; // Safety limit

    do {
      const ordersPage = await this.searchOrders({ ...filters, cursor, limit: 500 });
      allOrders.push(...ordersPage);
      pageCount++;
      
      // In a real implementation, you'd get the cursor from the response
      // For now, we'll break after first page
      cursor = undefined;
      break;
    } while (cursor && pageCount < maxPages);

    console.log(`📦 Total orders retrieved: ${allOrders.length} (${pageCount} pages)`);
    return allOrders;
  }

  // Helper method to get all payments across all pages  
  async getAllPayments(filters: SquareSalesFilters = {}): Promise<SquarePayment[]> {
    const allPayments: SquarePayment[] = [];
    let cursor: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = 50; // Safety limit

    do {
      const paymentsPage = await this.getPayments({ ...filters, cursor, limit: 500 });
      allPayments.push(...paymentsPage);
      pageCount++;
      
      // In a real implementation, you'd get the cursor from the response
      // For now, we'll break after first page
      cursor = undefined;
      break;
    } while (cursor && pageCount < maxPages);

    console.log(`💰 Total payments retrieved: ${allPayments.length} (${pageCount} pages)`);
    return allPayments;
  }
}

export const realSquareService = new RealSquareService();