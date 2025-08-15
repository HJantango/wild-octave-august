import { db } from './db'

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
  async syncProducts(): Promise<SyncResult> {
    try {
      console.log('Starting product sync...')
      
      const result: SyncResult = {
        success: 0,
        failed: 0,
        total: 0
      }

      await this.createSyncLog('products', 'success', result.total, result.success, result.failed)
      return result
    } catch (error) {
      console.error('Error syncing products:', error)
      await this.createSyncLog('products', 'failed', 0, 0, 1, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async syncInventory(): Promise<SyncResult> {
    try {
      console.log('Starting inventory sync...')
      
      const result: SyncResult = {
        success: 0,
        failed: 0,
        total: 0
      }

      await this.createSyncLog('inventory', 'success', result.total, result.success, result.failed)
      return result
    } catch (error) {
      console.error('Error syncing inventory:', error)
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
      
      const unlinkedProducts = await db.lineItem.findMany({
        where: { squareProductId: null },
        select: { productName: true },
        distinct: ['productName']
      })

      let linked = 0
      let created = 0

      for (const item of unlinkedProducts) {
        try {
          const existingProduct = await db.squareProduct.findFirst({
            where: {
              name: { contains: item.productName, mode: 'insensitive' }
            }
          })

          if (existingProduct) {
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
                confidence: 0.8,
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

      await this.createSyncLog('auto-link', 'success', unlinkedProducts.length, linked, unlinkedProducts.length - linked)
      return { linked, created }
    } catch (error) {
      console.error('Error auto-linking products:', error)
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

// Create singleton instance
let squareSyncInstance: SquareSyncService | null = null

export function getSquareSync(): SquareSyncService {
  if (!squareSyncInstance) {
    squareSyncInstance = new SquareSyncService()
  }
  return squareSyncInstance
}

// Export the singleton instance
export const squareSync = getSquareSync()
