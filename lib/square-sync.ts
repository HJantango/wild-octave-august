// Singleton instance for lazy initialization
let squareSyncInstance: SquareSyncService | null = null;

// Create a function to get the Square Sync service
export function getSquareSync(): SquareSyncService {
  if (!canInitializeSquareClient()) {
    throw new Error('Square Sync is not available - missing configuration or running in browser');
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
