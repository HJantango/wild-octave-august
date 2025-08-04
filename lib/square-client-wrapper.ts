
// Lazy Square client wrapper to prevent build-time initialization
import { SquareAPIClient, SquareLocation, SquareItem, SquareInventoryCount } from './square-api-client';

let squareClientInstance: SquareAPIClient | null = null;
let initializationError: Error | null = null;

/**
 * Get Square API client instance with lazy initialization
 * This prevents the client from being created during build time
 */
export function getSquareClient(): SquareAPIClient {
  // Return cached instance if available
  if (squareClientInstance) {
    return squareClientInstance;
  }

  // If we previously failed to initialize, throw the cached error
  if (initializationError) {
    throw initializationError;
  }

  try {
    // Only initialize on server-side at runtime
    if (typeof window !== 'undefined') {
      throw new Error('Square API client should only be used on the server side');
    }

    // Check if we're in a build environment
    if (process.env.NODE_ENV === 'production' && !process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token is required in production');
    }

    // For development/build, allow missing token but warn
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      console.warn('Square access token not found. Square API calls will fail.');
      throw new Error('Square access token is not configured');
    }

    squareClientInstance = new SquareAPIClient();
    return squareClientInstance;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Failed to initialize Square client');
    throw initializationError;
  }
}

/**
 * Check if Square client can be initialized
 */
export function canInitializeSquareClient(): boolean {
  try {
    if (typeof window !== 'undefined') return false;
    return !!process.env.SQUARE_ACCESS_TOKEN;
  } catch {
    return false;
  }
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetSquareClient(): void {
  squareClientInstance = null;
  initializationError = null;
}
