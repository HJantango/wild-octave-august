// Singleton instance for lazy initialization
let squareAPIInstance: SquareAPIService | null = null;

// Create a function to get the Square API service
export function getSquareAPI(): SquareAPIService {
  if (!canInitializeSquareClient()) {
    throw new Error('Square API is not available - missing configuration or running in browser');
  }
  
  if (!squareAPIInstance) {
    squareAPIInstance = new SquareAPIService();
  }
  
  return squareAPIInstance;
}

// Create a transparent proxy that behaves exactly like SquareAPIService
const createSquareAPIProxy = (): SquareAPIService => {
  return new Proxy({} as SquareAPIService, {
    get(target, prop, receiver) {
      const instance = getSquareAPI();
      const value = (instance as any)[prop];
      
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      
      return value;
    }
  });
};

// Export a transparent proxy that acts exactly like SquareAPIService
export const squareAPI: SquareAPIService = createSquareAPIProxy();
