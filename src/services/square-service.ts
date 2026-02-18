import { spawn } from 'child_process';

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

export interface SquareSalesFilters {
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
  limit?: number;
  cursor?: string;
}

// Singleton instance management
let squareServiceInstance: SquareService | null = null;
let connectionPromise: Promise<boolean> | null = null;
let isAuthenticating = false;

class SquareService {
  private mcpProcess: any = null;
  private isConnected = false;
  private lastAuthCheck = 0;
  private authCheckInterval = 30000; // 30 seconds

  constructor() {
    // Prevent multiple instances
    if (squareServiceInstance) {
      return squareServiceInstance;
    }
    squareServiceInstance = this;
  }

  async connect(): Promise<boolean> {
    // Return existing connection if available
    if (this.isConnected && this.mcpProcess && !this.mcpProcess.killed) {
      return true;
    }

    // Return existing connection promise to prevent multiple simultaneous connections
    if (connectionPromise) {
      return connectionPromise;
    }

    // Start new connection
    connectionPromise = this.establishConnection();
    
    try {
      const result = await connectionPromise;
      return result;
    } finally {
      connectionPromise = null;
    }
  }

  private async establishConnection(): Promise<boolean> {
    try {
      console.log('🔄 Connecting to Square MCP...');
      
      // Clean up any existing process
      if (this.mcpProcess) {
        this.mcpProcess.kill();
        this.mcpProcess = null;
      }

      // Start the MCP Square API process with better error handling
      this.mcpProcess = spawn('npx', ['mcp-remote', 'https://mcp.squareup.com/sse'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });

      // Wait for connection with improved handling
      return new Promise((resolve) => {
        let resolved = false;
        let authSuccessful = false;
        
        const resolveOnce = (success: boolean) => {
          if (!resolved) {
            resolved = true;
            this.isConnected = success;
            resolve(success);
          }
        };

        this.mcpProcess.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          
          // Look for authentication success indicators
          if (output.includes('Authorization successful') || 
              output.includes('authenticated') || 
              output.includes('Connected to Square MCP') ||
              output.includes('Connected to remote server using SSEClientTransport') ||
              output.includes('Proxy established successfully')) {
            console.log('✅ Square MCP authenticated successfully');
            authSuccessful = true;
            isAuthenticating = false;
            resolveOnce(true);
          } else if (output.includes('Please authorize') && !isAuthenticating) {
            console.log('🔐 Square authentication required - browser should open automatically');
            isAuthenticating = true;
          }
        });

        this.mcpProcess.stderr?.on('data', (data: Buffer) => {
          const error = data.toString();
          
          // Don't log routine authentication and connection messages as errors
          if (!error.includes('Please authorize') && 
              !error.includes('Browser opened') && 
              !error.includes('Authentication required') &&
              !error.includes('Waiting for authentication') &&
              !error.includes('Querying: http://127.0.0.1') &&
              !error.includes('Connected to remote server using SSEClientTransport') &&
              !error.includes('Local STDIO server running') &&
              !error.includes('Proxy established successfully') &&
              !error.includes('Press Ctrl+C to exit')) {
            console.error('❌ Square MCP Error:', error);
          }
          
          // Check for successful authentication and connection in stderr too
          if (error.includes('Authorization successful') || 
              error.includes('Connected to remote server using SSEClientTransport') ||
              error.includes('Proxy established successfully')) {
            console.log('✅ Square MCP authenticated successfully');
            authSuccessful = true;
            isAuthenticating = false;
            resolveOnce(true);
          }
        });

        this.mcpProcess.on('close', (code: number) => {
          console.log(`📡 Square MCP process exited with code ${code}`);
          this.isConnected = false;
          this.mcpProcess = null;
          if (!resolved && !authSuccessful) {
            resolveOnce(false);
          }
        });

        this.mcpProcess.on('error', (error: Error) => {
          console.error('❌ Square MCP process error:', error);
          resolveOnce(false);
        });

        // Extended timeout for authentication
        setTimeout(() => {
          if (!resolved) {
            if (isAuthenticating) {
              console.log('⏳ Square MCP authentication in progress, using mock data');
              resolveOnce(false); // Use mock data while auth is pending
            } else {
              console.log('⚠️  Square MCP connection timeout');
              resolveOnce(false);
            }
          }
        }, 15000); // Extended to 15 seconds
      });
    } catch (error) {
      console.error('❌ Failed to establish Square MCP connection:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isConnected = false;
    }
  }

  async callSquareAPI(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: any): Promise<any> {
    // Try to ensure connection
    const connected = await this.connect();
    
    if (!connected || !this.isConnected) {
      console.log('⚠️  Square MCP not connected, using mock data');
      throw new Error('Square MCP not connected');
    }

    try {
      // Since this is a conceptual implementation, we'll simulate the MCP call
      // In a real implementation, this would use the MCP protocol
      console.log(`📡 Square API Call: ${method} ${endpoint}`, params);
      
      // Simulate API response structure based on Square's actual API
      switch (endpoint) {
        case '/v2/catalog/list':
          return this.getMockCatalogItems();
        case '/v2/orders/search':
          return this.getMockOrders(params);
        case '/v2/payments':
          return this.getMockPayments(params);
        default:
          throw new Error(`Unsupported Square API endpoint: ${endpoint}`);
      }
    } catch (error) {
      console.error('❌ Square API call failed:', error);
      throw error;
    }
  }

  async getCatalogItems(filters?: { types?: string[]; categoryId?: string }): Promise<SquareItem[]> {
    try {
      const response = await this.callSquareAPI('/v2/catalog/list', 'GET', {
        types: filters?.types || ['ITEM'],
        category_id: filters?.categoryId,
      });
      
      return response.objects?.map((obj: any) => ({
        id: obj.id,
        name: obj.item_data?.name || 'Unknown Item',
        category: obj.item_data?.category_id ? {
          id: obj.item_data.category_id,
          name: obj.item_data.category_name || 'Uncategorized'
        } : undefined,
        variations: obj.item_data?.variations?.map((v: any) => ({
          id: v.id,
          name: v.item_variation_data?.name || 'Default',
          sku: v.item_variation_data?.sku || null,
          priceMoney: v.item_variation_data?.price_money || { amount: 0, currency: 'AUD' }
        })) || [],
        updatedAt: obj.updated_at,
        createdAt: obj.created_at,
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get catalog items:', error);
      return [];
    }
  }

  async searchOrders(filters: SquareSalesFilters = {}): Promise<SquareOrder[]> {
    try {
      const searchQuery: any = {
        filter: {
          date_time_filter: {
            created_at: {}
          }
        },
        limit: filters.limit || 100,
        cursor: filters.cursor
      };

      if (filters.startDate) {
        searchQuery.filter.date_time_filter.created_at.start_at = filters.startDate.toISOString();
      }
      if (filters.endDate) {
        searchQuery.filter.date_time_filter.created_at.end_at = filters.endDate.toISOString();
      }
      if (filters.locationId) {
        searchQuery.location_ids = [filters.locationId];
      }

      const response = await this.callSquareAPI('/v2/orders/search', 'POST', searchQuery);
      
      return response.orders?.map((order: any) => ({
        id: order.id,
        locationId: order.location_id,
        orderSource: order.source || { name: 'Unknown' },
        lineItems: order.line_items?.map((item: any) => ({
          catalogObjectId: item.catalog_object_id,
          variationName: item.variation_name,
          name: item.name,
          quantity: item.quantity,
          totalMoney: item.total_money || { amount: 0, currency: 'AUD' },
          totalTaxMoney: item.total_tax_money,
        })) || [],
        totalMoney: order.total_money || { amount: 0, currency: 'AUD' },
        totalTaxMoney: order.total_tax_money,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      })) || [];
    } catch (error) {
      console.error('❌ Failed to search orders:', error);
      return [];
    }
  }

  async getPayments(filters: SquareSalesFilters = {}): Promise<SquarePayment[]> {
    try {
      const params: any = {
        limit: filters.limit || 100,
        cursor: filters.cursor,
      };

      if (filters.startDate) {
        params.begin_time = filters.startDate.toISOString();
      }
      if (filters.endDate) {
        params.end_time = filters.endDate.toISOString();
      }
      if (filters.locationId) {
        params.location_id = filters.locationId;
      }

      const response = await this.callSquareAPI('/v2/payments', 'GET', params);
      
      return response.payments?.map((payment: any) => ({
        id: payment.id,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        amountMoney: payment.amount_money || { amount: 0, currency: 'AUD' },
        totalMoney: payment.total_money || { amount: 0, currency: 'AUD' },
        orderId: payment.order_id,
        status: payment.status,
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get payments:', error);
      return [];
    }
  }

  // Mock data methods for development/testing
  private getMockCatalogItems(): any {
    return {
      objects: [
        {
          id: 'ITEM_1',
          item_data: {
            name: 'Organic Kale Smoothie',
            category_id: 'CAT_SMOOTHIES',
            category_name: 'Smoothies',
            variations: [
              {
                id: 'VAR_1',
                item_variation_data: {
                  name: 'Regular',
                  price_money: { amount: 850, currency: 'AUD' }
                }
              },
              {
                id: 'VAR_2',
                item_variation_data: {
                  name: 'Large',
                  price_money: { amount: 1200, currency: 'AUD' }
                }
              }
            ]
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'ITEM_2',
          item_data: {
            name: 'Quinoa Power Bowl',
            category_id: 'CAT_BOWLS',
            category_name: 'Bowls',
            variations: [
              {
                id: 'VAR_3',
                item_variation_data: {
                  name: 'Regular',
                  price_money: { amount: 1650, currency: 'AUD' }
                }
              }
            ]
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]
    };
  }

  private getMockOrders(params?: any): any {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return {
      orders: [
        {
          id: 'ORDER_1',
          location_id: 'LOC_MAIN',
          source: { name: 'Square Point of Sale' },
          line_items: [
            {
              catalog_object_id: 'VAR_1',
              variation_name: 'Regular',
              name: 'Organic Kale Smoothie',
              quantity: '2',
              total_money: { amount: 1700, currency: 'AUD' },
              total_tax_money: { amount: 154, currency: 'AUD' }
            }
          ],
          total_money: { amount: 1700, currency: 'AUD' },
          total_tax_money: { amount: 154, currency: 'AUD' },
          created_at: yesterday.toISOString(),
          updated_at: yesterday.toISOString(),
        },
        {
          id: 'ORDER_2',
          location_id: 'LOC_MAIN',
          source: { name: 'Square Online' },
          line_items: [
            {
              catalog_object_id: 'VAR_3',
              variation_name: 'Regular',
              name: 'Quinoa Power Bowl',
              quantity: '1',
              total_money: { amount: 1650, currency: 'AUD' },
              total_tax_money: { amount: 150, currency: 'AUD' }
            }
          ],
          total_money: { amount: 1650, currency: 'AUD' },
          total_tax_money: { amount: 150, currency: 'AUD' },
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        }
      ]
    };
  }

  private getMockPayments(params?: any): any {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return {
      payments: [
        {
          id: 'PAYMENT_1',
          created_at: yesterday.toISOString(),
          updated_at: yesterday.toISOString(),
          amount_money: { amount: 1700, currency: 'AUD' },
          total_money: { amount: 1854, currency: 'AUD' },
          order_id: 'ORDER_1',
          status: 'COMPLETED'
        },
        {
          id: 'PAYMENT_2',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          amount_money: { amount: 1650, currency: 'AUD' },
          total_money: { amount: 1800, currency: 'AUD' },
          order_id: 'ORDER_2',
          status: 'COMPLETED'
        }
      ]
    };
  }
}

// Export singleton instance
export const squareService = new SquareService();