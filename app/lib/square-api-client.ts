
// Direct HTTP client for Square API
export interface SquareLocation {
  id: string;
  name: string;
  address?: any;
  timezone?: string;
  capabilities?: string[];
  status?: string;
  created_at?: string;
  merchant_id?: string;
}

export interface SquareItem {
  type: string;
  id: string;
  updated_at?: string;
  created_at?: string;
  version?: number;
  is_deleted?: boolean;
  present_at_all_locations?: boolean;
  item_data?: {
    name: string;
    description?: string;
    abbreviation?: string;
    label_color?: string;
    available_online?: boolean;
    available_for_pickup?: boolean;
    available_electronically?: boolean;
    category_id?: string;
    tax_ids?: string[];
    modifier_list_info?: any[];
    variations?: SquareItemVariation[];
    product_type?: string;
    skip_modifier_screen?: boolean;
    item_options?: any[];
    image_ids?: string[];
    sort_name?: string;
    description_html?: string;
    description_plaintext?: string;
  };
}

export interface SquareItemVariation {
  type: string;
  id: string;
  updated_at?: string;
  created_at?: string;
  version?: number;
  is_deleted?: boolean;
  present_at_all_locations?: boolean;
  item_variation_data?: {
    item_id: string;
    name: string;
    sku?: string;
    upc?: string;
    ordinal?: number;
    pricing_type: string;
    price_money?: {
      amount: number;
      currency: string;
    };
    location_overrides?: any[];
    track_inventory?: boolean;
    inventory_alert_type?: string;
    inventory_alert_threshold?: number;
    user_data?: string;
    service_duration?: number;
    available_for_booking?: boolean;
    item_option_values?: any[];
    measurement_unit_id?: string;
    sellable?: boolean;
    stockable?: boolean;
    image_ids?: string[];
    team_member_ids?: string[];
    stockable_conversion?: any;
  };
}

export interface SquareInventoryCount {
  catalog_object_id: string;
  catalog_object_type: string;
  state: string;
  location_id: string;
  quantity: string;
  calculated_at: string;
  is_estimated?: boolean;
}

export interface SquareInventoryAdjustment {
  id?: string;
  reference_id: string;
  from_state?: string;
  to_state?: string;
  location_id: string;
  catalog_object_id: string;
  catalog_object_type?: string;
  quantity: string;
  total_price_money?: {
    amount: number;
    currency: string;
  };
  occurred_at: string;
  created_at?: string;
  source?: any;
  employee_id?: string;
  team_member_id?: string;
  transaction_id?: string;
  refund_id?: string;
  purchase_order_id?: string;
  goods_receipt_id?: string;
  adjustment_group?: any;
}

export class SquareAPIClient {
  private baseURL: string;
  private accessToken: string;
  private applicationId: string;
  private environment: string;

  constructor() {
    this.environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    this.baseURL = this.environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    this.accessToken = process.env.SQUARE_ACCESS_TOKEN || '';
    this.applicationId = process.env.SQUARE_APPLICATION_ID || '';
    
    if (!this.accessToken) {
      throw new Error('Square access token is required');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-06-04',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Square API Error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  async getLocations(): Promise<SquareLocation[]> {
    const data = await this.makeRequest('/v2/locations');
    return data.locations || [];
  }

  async getCatalogObjects(types: string[] = ['ITEM']): Promise<SquareItem[]> {
    const data = await this.makeRequest('/v2/catalog/search', {
      method: 'POST',
      body: JSON.stringify({
        object_types: types,
        include_deleted_objects: false,
        include_related_objects: true,
        limit: 1000,
      }),
    });
    return data.objects || [];
  }

  async getCatalogObject(objectId: string): Promise<SquareItem | null> {
    try {
      const data = await this.makeRequest(`/v2/catalog/object/${objectId}?include_related_objects=true`);
      return data.object || null;
    } catch (error) {
      console.error('Error fetching catalog object:', error);
      return null;
    }
  }

  async createCatalogObject(catalogObject: any): Promise<SquareItem> {
    const data = await this.makeRequest('/v2/catalog/object', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: `${Date.now()}-${Math.random()}`,
        object: catalogObject,
      }),
    });
    return data.catalog_object;
  }

  async updateCatalogObject(catalogObject: any): Promise<SquareItem> {
    const data = await this.makeRequest('/v2/catalog/object', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: `${Date.now()}-${Math.random()}`,
        object: catalogObject,
      }),
    });
    return data.catalog_object;
  }

  async getInventoryCount(catalogObjectId: string, locationId: string): Promise<SquareInventoryCount | null> {
    try {
      const data = await this.makeRequest(`/v2/inventory/${catalogObjectId}?location_ids=${locationId}`);
      return data.counts?.[0] || null;
    } catch (error) {
      console.error('Error fetching inventory count:', error);
      return null;
    }
  }

  async batchChangeInventory(changes: any[]): Promise<void> {
    await this.makeRequest('/v2/inventory/changes/batch-create', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: `${Date.now()}-${Math.random()}`,
        changes: changes,
      }),
    });
  }

  async updateInventoryCount(catalogObjectId: string, quantity: number, locationId: string): Promise<void> {
    const changes = [{
      type: 'PHYSICAL_COUNT',
      physical_count: {
        reference_id: `${Date.now()}-${Math.random()}`,
        catalog_object_id: catalogObjectId,
        state: 'IN_STOCK',
        location_id: locationId,
        quantity: quantity.toString(),
        occurred_at: new Date().toISOString(),
      },
    }];

    await this.batchChangeInventory(changes);
  }

  async adjustInventoryCount(catalogObjectId: string, quantityChange: number, locationId: string): Promise<void> {
    const changes = [{
      type: 'ADJUSTMENT',
      adjustment: {
        reference_id: `${Date.now()}-${Math.random()}`,
        catalog_object_id: catalogObjectId,
        location_id: locationId,
        quantity: quantityChange.toString(),
        occurred_at: new Date().toISOString(),
      },
    }];

    await this.batchChangeInventory(changes);
  }

  async searchProducts(query: string): Promise<SquareItem[]> {
    const data = await this.makeRequest('/v2/catalog/search', {
      method: 'POST',
      body: JSON.stringify({
        object_types: ['ITEM'],
        include_deleted_objects: false,
        include_related_objects: true,
        query: {
          text_query: {
            filter: {
              names: [query],
            },
          },
        },
        limit: 100,
      }),
    });
    return data.objects || [];
  }

  async createProduct(name: string, description?: string, sku?: string, price?: number): Promise<SquareItem> {
    const itemId = `#${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const variationId = `#${name.replace(/[^a-zA-Z0-9]/g, '_')}_variation_${Date.now()}`;

    const catalogObject: any = {
      type: 'ITEM',
      id: itemId,
      item_data: {
        name,
        description,
        variations: [],
      },
    };

    if (price !== undefined) {
      catalogObject.item_data.variations.push({
        type: 'ITEM_VARIATION',
        id: variationId,
        item_variation_data: {
          item_id: itemId,
          name: 'Regular',
          pricing_type: 'FIXED_PRICING',
          price_money: {
            amount: Math.round(price * 100), // Convert to cents
            currency: 'AUD',
          },
        },
      });
    }

    return await this.createCatalogObject(catalogObject);
  }

  // Fuzzy matching for product names
  calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Levenshtein distance
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= s2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }
    
    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  }

  async findBestProductMatch(productName: string, threshold: number = 0.7): Promise<{ product: SquareItem; confidence: number } | null> {
    try {
      const products = await this.getCatalogObjects(['ITEM']);
      let bestMatch: { product: SquareItem; confidence: number } | null = null;
      
      for (const product of products) {
        if (product.item_data?.name) {
          const confidence = this.calculateSimilarity(productName, product.item_data.name);
          if (confidence >= threshold && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { product, confidence };
          }
        }
      }
      
      return bestMatch;
    } catch (error) {
      console.error('Error finding product match:', error);
      throw error;
    }
  }

  async getDefaultLocation(): Promise<SquareLocation> {
    const locations = await this.getLocations();
    if (locations.length === 0) {
      throw new Error('No Square locations found');
    }
    return locations[0];
  }
}

// Remove the global instance export - use the wrapper instead
// export const squareAPIClient = new SquareAPIClient();
