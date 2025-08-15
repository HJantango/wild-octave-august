import { squareSync } from './square-sync'

export class CronScheduler {
  private intervalId: NodeJS.Timeout | null = null
  
  constructor() {
    this.setupDailySync()
  }

  private setupDailySync() {
    // Calculate milliseconds until next 5:00 AM AEST
    const now = new Date()
    const nextSync = new Date()
    
    // Set to 5:00 AM AEST (UTC+10/+11 depending on DST)
    nextSync.setHours(5, 0, 0, 0)
    
    // If it's already past 5:00 AM today, schedule for tomorrow
    if (now > nextSync) {
      nextSync.setDate(nextSync.getDate() + 1)
    }
    
    const msUntilNextSync = nextSync.getTime() - now.getTime()
    
    console.log(`Next Square sync scheduled for: ${nextSync.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`)
    
    // Schedule the first sync
    setTimeout(() => {
      this.runDailySync()
      
      // Then schedule it to run every 24 hours
      this.intervalId = setInterval(() => {
        this.runDailySync()
      }, 24 * 60 * 60 * 1000) // 24 hours
    }, msUntilNextSync)
  }

  private async runDailySync() {
    try {
      console.log('Starting automated daily Square sync...')
      
      const results = await squareSync.performDailySync()
      const autoLinkResults = await squareSync.autoLinkProducts()
      
      console.log('Daily sync completed successfully:', {
        products: results.products,
        inventory: results.inventory,
        autoLink: autoLinkResults
      })
    } catch (error) {
      console.error('Daily sync failed:', error)
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// Export a singleton instance
export const cronScheduler = new CronScheduler()
