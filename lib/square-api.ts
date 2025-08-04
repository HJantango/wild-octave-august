
import { getSquareClient, canInitializeSquareClient } from './square-client-wrapper';
import { SquareLocation, SquareItem, SquareInventoryCount } from './square-api-client';

export class SquareAPIService {
  private locationId: string = '';

  private getClient() {
    return getSquareClient();
  }

  async getLocations(): Promise<SquareLocation[]> {
    try {
      const client = this.getClient();
      return await client.getLocations();
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
      const client = this.getClient();
      return await client.getCatalogObjects(types);
    } catch (error) {
      console.error('Error fetching catalog objects:', error);
      throw error;
    }
  }

  async getCatalogObjectById(objectId: string): Promise<SquareItem | null> {
    try {
      const client = this.getClient();
      return await client.getCatalogObject(objectId);
    } catch (error) {
      console.error('Error fetching catalog object:', error);
      throw error;
    }
  }

  async createCatalogObject(catalogObject: any): Promise<SquareItem> {
    try {
      const client = this.getClient();
      return await client.createCatalogObject(catalogObject);
    } catch (error) {
      console.error('Error creating catalog object:', error);
      throw error;
    }
  }

  async updateCatalogObject(catalogObject: any): Promise<SquareItem> {
    try {
      const client = this.getClient();
      return await client.updateCatalogObject(catalogObject);
    } catch (error) {
      console.error('Error updating catalog object:', error);
      throw error;
    }
  }

  async getInventoryCount(catalogObjectId: string, locationId?: string): Promise<SquareInventoryCount | null> {
    try {
      const client = this.getClient();
      const location = locationId || (await this.getDefaultLocation()).id!;
      return await client.getInventoryCount(catalogObjectId, location);
    } catch (error) {
      console.error('Error fetching inventory count:', error);
      throw error;
    }
  }

  async updateInventoryCount(catalogObjectId: string, quantity: number, locationId?: string): Promise<void> {
    try {
      const client = this.getClient();
      const location = locationId || (await this.getDefaultLocation()).id!;
      await client.updateInventoryCount(catalogObjectId, quantity, location);
    } catch (error) {
      console.error('Error updating inventory count:', error);
      throw error;
    }
  }

  async adjustInventoryCount(catalogObjectId: string, quantityChange: number, locationId?: string): Promise<void> {
    try {
      const client = this.getClient();
      const location = locationId || (await this.getDefaultLocation()).id!;
      await client.adjustInventoryCount(catalogObjectId, quantityChange, location);
    } catch (error) {
      console.error('Error adjusting inventory count:', error);
      throw error;
    }
  }

  async searchProducts(query: string): Promise<SquareItem[]> {
    try {
      const client = this.getClient();
      return await client.searchProducts(query);
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  async createProduct(name: string, description?: string, sku?: string, price?: number): Promise<SquareItem> {
    try {
      const client = this.getClient();
      return await client.createProduct(name, description, sku, price);
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Fuzzy matching for product names
  calculateSimilarity(str1: string, str2: string): number {
    const client = this.getClient();
    return client.calculateSimilarity(str1, str2);
  }

  async findBestProductMatch(productName: string, threshold: number = 0.7): Promise<{ product: SquareItem, confidence: number } | null> {
    try {
      const client = this.getClient();
      return await client.findBestProductMatch(productName, threshold);
    } catch (error) {
      console.error('Error finding product match:', error);
      throw error;
    }
  }
}

// Create a function to get the Square API service
export function getSquareAPI(): SquareAPIService {
  if (!canInitializeSquareClient()) {
    throw new Error('Square API is not available - missing configuration or running in browser');
  }
  return new SquareAPIService();
}

// For backward compatibility, export a getter function
export const squareAPI = {
  get instance() {
    return getSquareAPI();
  }
};
