
import { getSquareSync } from '../lib/square-sync'
import { canInitializeSquareClient } from '../lib/square-client-wrapper'

async function setupCron() {
  try {
    console.log('Setting up cron job for Square sync...')
    
    // Check if Square client can be initialized
    if (!canInitializeSquareClient()) {
      console.error('Square API not available - check environment configuration')
      console.log('Required environment variables:')
      console.log('- SQUARE_ACCESS_TOKEN')
      console.log('- SQUARE_ENVIRONMENT (optional, defaults to sandbox)')
      console.log('- SQUARE_APPLICATION_ID (optional)')
      return
    }

    console.log('Square API configuration found')
    
    // Test the sync function
    console.log('Testing sync function...')
    const squareSyncService = getSquareSync()
    const results = await squareSyncService.performDailySync()
    console.log('Sync test completed:', results)
    
  } catch (error) {
    console.error('Error setting up cron:', error)
  }
}

setupCron()
