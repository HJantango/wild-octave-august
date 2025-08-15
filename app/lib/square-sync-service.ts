import { db } from './db'
import { canInitializeSquareClient } from './square-client-wrapper'

export interface SyncResult {
  success: number;
  failed: number;
  total: number;
}

export interface DailySyncResult {
  products: SyncResult;
  inventory: SyncResult;
}

export interface AutoLinkResult {
  linked: number;
  created: number;
}

export class SquareSyncService {
  constructor() {
    // Constructor can be empty for now
  }

  async syncProducts(): Promise<SyncResult> {
    try {
      console.log('Starting product sync...')
      
      // For now, return a mock result since Square API integration is optional
      // In production, this would sync with Square API
      const result: SyncResult = {
        success: 0,
        failed: 0,
        total: 0
      }

      // Create sync log
      await this.createSyncLog('products', 'success', result.total, result.success, result.failed)
      
      return result
    } catch (error) {
      console.error('Error syncing products:', error)
      
      // Create error log
      await this.createSyncLog('products', 'failed', 0, 0, 1, error instanceof Error ? error.message : 'Unknown error')
      
      throw error
    }
  }

  async syncInventory(): Promise<SyncResult> {
    try {
      console.log('Starting inventory sync...')
      
      // For now, return a mock result since Square API integration is optional
      const result: SyncResult = {
        success: 0,
        failed: 0,
        total: 0
      }

      // Create sync log
      await this.createSyncLog('inventory', 'success', result.total, result.success, result.failed)
      
      return result
    } catch (error) {
      console.error('Error syncing inventory:', error)
      
      // Create error log
      await this.createSyncLog('inventory', 'failed', 0, 0, 1, error instanceof Error ? error.message : 'Unknown error')
      
      throw error
    }
  }

  async performDailySync(): Promise<DailySyncResult> {
    try {
      console.log('Starting daily sync...')
      
      const products = await this.syncProducts()
      const inventory = await this.syncInventory()
      
      return { products, inventory }
    } catch (error) {
      console.error('Error performing daily sync:', error)
      throw error
    }
  }

  async autoLinkProducts(): Promise<AutoLinkResult> {
    try {
      console.log('Starting auto-link products...')
      
      // Get unlinked invoice products
      const unlinkedProducts = await db.lineItem.findMany({
        where: {
          squareProductId: null
        },
        select: {
          productName: true
        },
        distinct: ['productName']
      })

      let linked = 0
      let created = 0

      for (const item of unlinkedProducts) {
        try {
          // Try to find existing Square product by name similarity
          const existingProduct = await db.squareProduct.findFirst({
            where: {
              name: {
                contains: item.productName,
                mode: 'insensitive'
              }
            }
          })

          if (existingProduct) {
            // Create product link
            await db.productLink.upsert({
              where: {
                invoiceProductName_squareProductId: {
                  invoiceProductName: item.productName,
                  squareProductId: existingProduct.id
                }
              },
              update: {},
              create: {
                invoiceProductName: item.productName,
                squareProductId: existingProduct.id,
                confidence: 0.8, // Approximate match
                isManualLink: false,
                linkedBy: 'auto-sync'
              }
            })
            
            linked++
          }
        } catch (error) {
          console.error(`Error auto-linking product ${item.productName}:`, error)
        }
      }

      // Create sync log
      await this.createSyncLog('auto-link', 'success', unlinkedProducts.length, linked, unlinkedProducts.length - linked)
      
      return { linked, created }
    } catch (error) {
      console.error('Error auto-linking products:', error)
      
      // Create error log
      await this.createSyncLog('auto-link', 'failed', 0, 0, 1, error instanceof Error ? error.message : 'Unknown error')
      
      throw error
    }
  }

  private async createSyncLog(
    syncType: string,
    status: string,
    itemsProcessed: number,
    itemsSuccess: number,
    itemsFailed: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.syncLog.create({
        data: {
          syncType,
          status,
          itemsProcessed,
          itemsSuccess,
          itemsFailed,
          errorMessage,
          startedAt: new Date(),
          completedAt: new Date()
        }
      })
    } catch (error) {
      console.error('Error creating sync log:', error)
    }
  }
}

// Singleton instance for lazy initialization
let squareSyncInstance: SquareSyncService | null = null;

// Create a function to get the Square Sync service
export function getSquareSync(): SquareSyncService {
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
    }
  });
};

// Export a transparent proxy that acts exactly like SquareSyncService
export const squareSync: SquareSyncService = createSquareSyncProxy();
