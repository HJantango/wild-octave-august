
import { getSquareSync } from './square-sync'
import { canInitializeSquareClient } from './square-client-wrapper'

export class CronScheduler {
  private jobs: Map<string, any> = new Map()

  constructor() {
    console.warn('CronScheduler: node-cron not available, scheduling disabled')
  }

  private async runDailySync() {
    try {
      // Check if Square client can be initialized
      if (!canInitializeSquareClient()) {
        console.error('Square API not available for scheduled sync - missing configuration')
        return
      }

      console.log('Starting automated daily Square sync...')
      
      // Get Square sync service instance
      const squareSyncService = getSquareSync()
      
      const results = await squareSyncService.performDailySync()
      const autoLinkResults = await squareSyncService.autoLinkProducts()
      
      console.log('Daily sync completed successfully:', {
        products: results.products,
        inventory: results.inventory,
        autoLink: autoLinkResults
      })
    } catch (error) {
      console.error('Automated daily sync failed:', error)
    }
  }

  start() {
    console.warn('Cron scheduler not available - node-cron not installed')
  }

  stop() {
    console.warn('Cron scheduler not available - node-cron not installed')
  }

  // Manual trigger for testing
  async triggerDailySync() {
    await this.runDailySync()
  }
}

export const cronScheduler = new CronScheduler()
