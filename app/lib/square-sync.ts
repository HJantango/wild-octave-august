
import { getSquareAPI, squareAPI } from './square-api';
import { canInitializeSquareClient } from './square-client-wrapper';
import { prisma } from './db';

export class SquareSyncService {
  
  private getSquareAPI() {
    if (!canInitializeSquareClient()) {
      throw new Error('Square API is not available - check environment configuration');
    }
    return getSquareAPI();
  }

  async syncProducts(): Promise<{ success: number, failed: number, total: number }> {
    const syncLog = await prisma.syncLog.create({
      data: {
        syncType: 'products',
        status: 'running',
        startedAt: new Date()
      }
    });

    let successCount = 0;
    let failedCount = 0;
    let totalCount = 0;

    try {
      console.log('Starting Square products sync...');
      
      // Get Square API instance
      const squareAPIInstance = this.getSquareAPI();
      
      // Get all products from Square
      const squareProducts = await squareAPIInstance.getCatalogObjects(['ITEM']);
      totalCount = squareProducts.length;

      console.log(`Found ${totalCount} products in Square`);

      for (const squareProduct of squareProducts) {
        try {
          if (!squareProduct.item_data?.name) {
            console.warn(`Skipping product without name: ${squareProduct.id}`);
            continue;
          }

          const existingProduct = await prisma.squareProduct.findUnique({
            where: { squareId: squareProduct.id! }
          });

          const productData = {
            squareId: squareProduct.id!,
            name: squareProduct.item_data.name,
            description: squareProduct.item_data.description || null,
            sku: squareProduct.item_data.variations?.[0]?.item_variation_data?.sku || null,
            category: squareProduct.item_data.category_id || null,
            price: squareProduct.item_data.variations?.[0]?.item_variation_data?.price_money?.amount 
              ? squareProduct.item_data.variations[0].item_variation_data!.price_money!.amount / 100 
              : null,
            currency: squareProduct.item_data.variations?.[0]?.item_variation_data?.price_money?.currency || 'AUD',
            isActive: !squareProduct.is_deleted,
            squareCreatedAt: squareProduct.created_at ? new Date(squareProduct.created_at) : null,
            squareUpdatedAt: squareProduct.updated_at ? new Date(squareProduct.updated_at) : null,
            lastSyncedAt: new Date()
          };

          if (existingProduct) {
            await prisma.squareProduct.update({
              where: { id: existingProduct.id },
              data: productData
            });
          } else {
            await prisma.squareProduct.create({
              data: productData
            });
          }

          successCount++;
          console.log(`✓ Synced product: ${squareProduct.item_data.name}`);

        } catch (error) {
          console.error(`Error syncing product ${squareProduct.id}:`, error);
          failedCount++;
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'success',
          itemsProcessed: totalCount,
          itemsSuccess: successCount,
          itemsFailed: failedCount,
          completedAt: new Date()
        }
      });

      console.log(`Product sync completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount, total: totalCount };

    } catch (error) {
      console.error('Error during product sync:', error);
      
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          itemsProcessed: totalCount,
          itemsSuccess: successCount,
          itemsFailed: failedCount,
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  async syncInventory(): Promise<{ success: number, failed: number, total: number }> {
    const syncLog = await prisma.syncLog.create({
      data: {
        syncType: 'inventory',
        status: 'running',
        startedAt: new Date()
      }
    });

    let successCount = 0;
    let failedCount = 0;
    let totalCount = 0;

    try {
      console.log('Starting Square inventory sync...');
      
      // Get Square API instance
      const squareAPIInstance = this.getSquareAPI();
      
      // Get all Square products from our database
      const squareProducts = await prisma.squareProduct.findMany({
        where: { isActive: true }
      });

      totalCount = squareProducts.length;
      console.log(`Found ${totalCount} products to sync inventory for`);

      const defaultLocation = await squareAPIInstance.getDefaultLocation();
      const locationId = defaultLocation.id!;

      for (const squareProduct of squareProducts) {
        try {
          const inventoryCount = await squareAPIInstance.getInventoryCount(squareProduct.squareId, locationId);
          
          const existingInventory = await prisma.squareInventory.findUnique({
            where: { 
              squareProductId_locationId: {
                squareProductId: squareProduct.id,
                locationId: locationId
              }
            }
          });

          const quantity = inventoryCount?.quantity ? parseFloat(inventoryCount.quantity) : 0;

          if (existingInventory) {
            await prisma.squareInventory.update({
              where: { id: existingInventory.id },
              data: {
                quantity: quantity,
                lastUpdated: new Date()
              }
            });
          } else {
            await prisma.squareInventory.create({
              data: {
                squareProductId: squareProduct.id,
                locationId: locationId,
                quantity: quantity,
                lastUpdated: new Date()
              }
            });
          }

          successCount++;
          console.log(`✓ Synced inventory for: ${squareProduct.name} (${quantity})`);

        } catch (error) {
          console.error(`Error syncing inventory for ${squareProduct.name}:`, error);
          failedCount++;
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'success',
          itemsProcessed: totalCount,
          itemsSuccess: successCount,
          itemsFailed: failedCount,
          completedAt: new Date()
        }
      });

      console.log(`Inventory sync completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount, total: totalCount };

    } catch (error) {
      console.error('Error during inventory sync:', error);
      
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          itemsProcessed: totalCount,
          itemsSuccess: successCount,
          itemsFailed: failedCount,
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  async performDailySync(): Promise<{ products: any, inventory: any }> {
    console.log('Starting daily Square sync...');
    
    const results = {
      products: await this.syncProducts(),
      inventory: await this.syncInventory()
    };

    console.log('Daily sync completed:', results);
    return results;
  }

  async autoLinkProducts(): Promise<{ linked: number, created: number }> {
    console.log('Starting auto-linking products...');
    
    let linkedCount = 0;
    let createdCount = 0;

    try {
      // Get Square API instance
      const squareAPIInstance = this.getSquareAPI();

      // Get all line items that don't have a Square product link
      const unlinkedLineItems = await prisma.lineItem.findMany({
        where: {
          squareProductId: null,
          needsClarification: false
        },
        select: {
          productName: true
        },
        distinct: ['productName']
      });

      for (const lineItem of unlinkedLineItems) {
        try {
          // Check if we already have a product link for this name
          const existingLink = await prisma.productLink.findFirst({
            where: {
              invoiceProductName: lineItem.productName
            }
          });

          if (existingLink) {
            // Update all line items with this product name
            await prisma.lineItem.updateMany({
              where: {
                productName: lineItem.productName,
                squareProductId: null
              },
              data: {
                squareProductId: existingLink.squareProductId
              }
            });
            linkedCount++;
            continue;
          }

          // Try to find a matching Square product
          const match = await squareAPIInstance.findBestProductMatch(lineItem.productName, 0.8);
          
          if (match) {
            // Find the Square product in our database
            const squareProduct = await prisma.squareProduct.findUnique({
              where: { squareId: match.product.id! }
            });

            if (squareProduct) {
              // Create a product link
              await prisma.productLink.create({
                data: {
                  invoiceProductName: lineItem.productName,
                  squareProductId: squareProduct.id,
                  confidence: match.confidence,
                  isManualLink: false
                }
              });

              // Update all line items with this product name
              await prisma.lineItem.updateMany({
                where: {
                  productName: lineItem.productName,
                  squareProductId: null
                },
                data: {
                  squareProductId: squareProduct.id
                }
              });

              linkedCount++;
              console.log(`✓ Auto-linked: ${lineItem.productName} -> ${squareProduct.name} (${match.confidence.toFixed(2)})`);
            }
          } else {
            // No match found, create a new product in Square
            try {
              const newSquareProduct = await squareAPIInstance.createProduct(lineItem.productName);
              
              // Save the new product to our database
              const savedProduct = await prisma.squareProduct.create({
                data: {
                  squareId: newSquareProduct.id!,
                  name: newSquareProduct.item_data?.name || lineItem.productName,
                  description: newSquareProduct.item_data?.description || null,
                  sku: newSquareProduct.item_data?.variations?.[0]?.item_variation_data?.sku || null,
                  category: newSquareProduct.item_data?.category_id || null,
                  price: newSquareProduct.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount 
                    ? newSquareProduct.item_data.variations[0].item_variation_data!.price_money!.amount / 100 
                    : null,
                  currency: 'AUD',
                  isActive: true,
                  lastSyncedAt: new Date()
                }
              });

              // Create a product link
              await prisma.productLink.create({
                data: {
                  invoiceProductName: lineItem.productName,
                  squareProductId: savedProduct.id,
                  confidence: 1.0,
                  isManualLink: false
                }
              });

              // Update all line items with this product name
              await prisma.lineItem.updateMany({
                where: {
                  productName: lineItem.productName,
                  squareProductId: null
                },
                data: {
                  squareProductId: savedProduct.id
                }
              });

              createdCount++;
              console.log(`✓ Created new product: ${lineItem.productName}`);
            } catch (error) {
              console.error(`Error creating product for ${lineItem.productName}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error processing ${lineItem.productName}:`, error);
        }
      }

      console.log(`Auto-linking completed: ${linkedCount} linked, ${createdCount} created`);
      return { linked: linkedCount, created: createdCount };

    } catch (error) {
      console.error('Error during auto-linking:', error);
      throw error;
    }
  }
}

// Singleton instance for lazy initialization
let squareSyncInstance: SquareSyncService | null = null;

// Create a function to get the Square sync service
export function getSquareSync(): SquareSyncService {
  if (!canInitializeSquareClient()) {
    throw new Error('Square sync is not available - missing configuration');
  }
  
  if (!squareSyncInstance) {
    squareSyncInstance = new SquareSyncService();
  }
  
  return squareSyncInstance;
}

// Create a transparent proxy that behaves exactly like SquareSyncService
const createSquareSyncProxy = (): SquareSyncService => {
  return new Proxy({} as SquareSyncService, {
    get(target, prop, receiver) {
      const instance = getSquareSync();
      const value = (instance as any)[prop];
      
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      
      return value;
    },
    
    set(target, prop, value, receiver) {
      const instance = getSquareSync();
      (instance as any)[prop] = value;
      return true;
    },
    
    has(target, prop) {
      const instance = getSquareSync();
      return prop in instance;
    },
    
    ownKeys(target) {
      const instance = getSquareSync();
      return Reflect.ownKeys(instance);
    },
    
    getOwnPropertyDescriptor(target, prop) {
      const instance = getSquareSync();
      return Reflect.getOwnPropertyDescriptor(instance, prop);
    }
  });
};

// Export a transparent proxy that acts exactly like SquareSyncService
export const squareSync: SquareSyncService = createSquareSyncProxy();
