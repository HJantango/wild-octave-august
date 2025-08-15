
import { getSquareAPI } from '../lib/square-api'
import { getSquareSync } from '../lib/square-sync'
import { canInitializeSquareClient } from '../lib/square-client-wrapper'

async function testSquareIntegration() {
  try {
    console.log('Testing Square API integration...')
    
    // Check if Square client can be initialized
    if (!canInitializeSquareClient()) {
      console.error('Square API not available - check environment configuration')
      console.log('Required environment variables:')
      console.log('- SQUARE_ACCESS_TOKEN')
      console.log('- SQUARE_ENVIRONMENT (optional, defaults to sandbox)')
      console.log('- SQUARE_APPLICATION_ID (optional)')
      return
    }

    // Get Square API instance
    const squareAPI = getSquareAPI()
    const squareSync = getSquareSync()
    
    // Test 1: Get locations
    console.log('\n1. Testing locations...')
    const locations = await squareAPI.getLocations()
    console.log(`Found ${locations.length} locations:`)
    locations.forEach((loc: any) => console.log(`  - ${loc.name} (${loc.id})`))
    
    // Test 2: Get catalog objects
    console.log('\n2. Testing catalog objects...')
    const products = await squareAPI.getCatalogObjects(['ITEM'])
    console.log(`Found ${products.length} products in catalog`)
    
    // Test 3: Test product sync
    console.log('\n3. Testing product sync...')
    const syncResults = await squareSync.syncProducts()
    console.log('Product sync results:', syncResults)
    
    // Test 4: Test inventory sync
    console.log('\n4. Testing inventory sync...')
    const inventoryResults = await squareSync.syncInventory()
    console.log('Inventory sync results:', inventoryResults)
    
    // Test 5: Test auto-linking
    console.log('\n5. Testing auto-linking...')
    const autoLinkResults = await squareSync.autoLinkProducts()
    console.log('Auto-link results:', autoLinkResults)
    
    console.log('\n✅ All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testSquareIntegration()
