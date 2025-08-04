
import { squareAPIClient, SquareLocation, SquareItem, SquareInventoryCount } from './square-api-client';

export class SquareAPIService {
  private client = squareAPIClient;
  private locationId: string = '';

  constructor() {
    // Client is initialized in square-api-client.ts
  }

  async getLocations(): Promise<SquareLocation[]> {
    try {
      return await this.client.getLocations();
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  async getDefaultLocation(): Promise<SquareLocation> {
    if (!this.locationId) {
      const locations = await this.getLocations();
      if (locations.length === 0) {
        throw new Error('No Square locations found');
      }
      this.locationId = locations[0].id!;
      return locations[0];
    }
    
    const locations = await this.getLocations();
    return locations.find(loc => loc.id === this.locationId) || locations[0];
  }

  async getCatalogObjects(types: string[] = ['ITEM']): Promise<SquareItem[]> {
    try {
      return await this.client.getCatalogObjects(types);
    } catch (error) {
      console.error('Error fetching catalog objects:', error);
      throw error;
    }
  }

  async getCatalogObjectById(objectId: string): Promise<SquareItem | null> {
    try {
      return await this.client.getCatalogObject(objectId);
    } catch (error) {
      console.error('Error fetching catalog object:', error);
      throw error;
    }
  }

  async createCatalogObject(catalogObject: any): Promise<SquareItem> {
    try {
      return await this.client.createCatalogObject(catalogObject);
    } catch (error) {
      console.error('Error creating catalog object:', error);
      throw error;
    }
  }

  async updateCatalogObject(catalogObject: any): Promise<SquareItem> {
    try {
      return await this.client.updateCatalogObject(catalogObject);
    } catch (error) {
      console.error('Error updating catalog object:', error);
      throw error;
    }
  }

  async getInventoryCount(catalogObjectId: string, locationId?: string): Promise<SquareInventoryCount | null> {
    try {
      const location = locationId || (await this.getDefaultLocation()).id!;
      return await this.client.getInventoryCount(catalogObjectId, location);
    } catch (error) {
      console.error('Error fetching inventory count:', error);
      throw error;
    }
  }

  async updateInventoryCount(catalogObjectId: string, quantity: number, locationId?: string): Promise<void> {
    try {
      const location = locationId || (await this.getDefaultLocation()).id!;
      await this.client.updateInventoryCount(catalogObjectId, quantity, location);
    } catch (error) {
      console.error('Error updating inventory count:', error);
      throw error;
    }
  }

  async adjustInventoryCount(catalogObjectId: string, quantityChange: number, locationId?: string): Promise<void> {
    try {
      const location = locationId || (await this.getDefaultLocation()).id!;
      await this.client.adjustInventoryCount(catalogObjectId, quantityChange, location);
    } catch (error) {
      console.error('Error adjusting inventory count:', error);
      throw error;
    }
  }

  async searchProducts(query: string): Promise<SquareItem[]> {
    try {
      return await this.client.searchProducts(query);
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  async createProduct(name: string, description?: string, sku?: string, price?: number): Promise<SquareItem> {
    try {
      return await this.client.createProduct(name, description, sku, price);
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Fuzzy matching for product names
  calculateSimilarity(str1: string, str2: string): number {
    return this.client.calculateSimilarity(str1, str2);
  }

  async findBestProductMatch(productName: string, threshold: number = 0.7): Promise<{ product: SquareItem, confidence: number } | null> {
    try {
      return await this.client.findBestProductMatch(productName, threshold);
    } catch (error) {
      console.error('Error finding product match:', error);
      throw error;
    }
  }
}

export const squareAPI = new SquareAPIService();
