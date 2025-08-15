import { SquareAPIService, getSquareAPI } from './square-api-service'
import { canInitializeSquareClient } from './square-client-wrapper'

// Export types
export type {
  SquareLocation,
  SquareItem
} from './square-api-service'

// Export the service class
export { SquareAPIService }

// Export a transparent proxy that acts exactly like SquareAPIService
export const squareAPI: SquareAPIService = getSquareAPI();
