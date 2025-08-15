import { db } from './db'
import { canInitializeSquareClient } from './square-client-wrapper'

export interface SquareLocation {
  id: string;
  name: string;
  address?: any;
  timezone?: string;
  capabilities?: string[];
  status?: string;
}

export interface SquareItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price?: number;
  isActive: boolean;
}

export class SquareAPIService {
  constructor() {
    // Constructor can be empty for now
  }

  async getLocations(): Promise<SquareLocation[]> {
    try {
      // For now, return a mock location
      // In production, this would call Square API
      return [
        {
          id: 'default_location',
          name: 'Main Location',
          status: 'ACTIVE'
        }
      ]
    } catch (error) {
      console.error('Error getting locations:', error)
      throw error
    }
  }

  async getCatalogObjects(types: string[] = ['ITEM']): Promise<SquareItem[]> {
    try {
      // Get items from database instead of Square API for now
      const products = await db.squareProduct.findMany({
        where: {
          isActive: true
        }
      })

      return products.map(product => ({
        id: product.squareId,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: product.price,
        isActive: product.isActive
      }))
    } catch (error) {
      console.error('Error getting catalog objects:', error)
      throw error
    }
  }

  async searchProducts(query: string): Promise<SquareItem[]> {
    try {
      const products = await db.squareProduct.findMany({
        where: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              sku: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ],
          isActive: true
        }
      })

      return products.map(product => ({
        id: product.squareId,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: product.price,
        isActive: product.isActive
      }))
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  }

  async createProduct(name: string, description?: string, sku?: string, price?: number): Promise<SquareItem> {
    try {
      const product = await db.squareProduct.create({
        data: {
          squareId: `temp_${Date.now()}`, // Temporary ID until Square sync
          name,
          description,
          sku,
          price,
          currency: 'AUD',
          isActive: true,
          lastSyncedAt: new Date()
        }
      })

      return {
        id: product.squareId,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: product.price,
        isActive: product.isActive
      }
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  }

  // Fuzzy matching for product names
  calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Simple similarity check
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Levenshtein distance approximation
    const maxLength = Math.max(s1.length, s2.length);
    const minLength = Math.min(s1.length, s2.length);
    
    return minLength / maxLength;
  }

  async findBestProductMatch(productName: string, threshold: number = 0.7): Promise<{ product: SquareItem; confidence: number } | null> {
    try {
      const products = await this.getCatalogObjects(['ITEM']);
      let bestMatch: { product: SquareItem; confidence: number } | null = null;
      
      for (const product of products) {
        const confidence = this.calculateSimilarity(productName, product.name);
        if (confidence >= threshold && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { product, confidence };
        }
      }
      
      return bestMatch;
    } catch (error) {
      console.error('Error finding product match:', error)
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

// Singleton instance for lazy initialization
let squareAPIInstance: SquareAPIService | null = null;

// Create a function to get the Square API service
export function getSquareAPI(): SquareAPIService {
  if (!squareAPIInstance) {
    squareAPIInstance = new SquareAPIService();
  }
  
  return squareAPIInstance;
}

// Create a transparent proxy that behaves exactly like SquareAPIService
const createSquareAPIProxy = (): SquareAPIService => {
  return new Proxy({} as SquareAPIService, {
    get(target, prop, receiver) {
      const instance = getSquareAPI();
      const value = (instance as any)[prop];
      
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      
      return value;
    }
  });
};

// Export a transparent proxy that acts exactly like SquareAPIService
export const squareAPI: SquareAPIService = createSquareAPIProxy();
