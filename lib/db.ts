import { PrismaClient } from '@prisma/client';

// Singleton instance for lazy initialization
let prismaInstance: PrismaClient | null = null;

// Create a function to get the Prisma client
function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// Create a transparent proxy that behaves exactly like PrismaClient
const createPrismaProxy = (): PrismaClient => {
  return new Proxy({} as PrismaClient, {
    get(target, prop, receiver) {
      const instance = getPrismaClient();
      const value = (instance as any)[prop];
      
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      
      return value;
    },
    
    set(target, prop, value, receiver) {
      const instance = getPrismaClient();
      (instance as any)[prop] = value;
      return true;
    },
    
    has(target, prop) {
      const instance = getPrismaClient();
      return prop in instance;
    },
    
    ownKeys(target) {
      const instance = getPrismaClient();
      return Reflect.ownKeys(instance);
    },
    
    getOwnPropertyDescriptor(target, prop) {
      const instance = getPrismaClient();
      return Reflect.getOwnPropertyDescriptor(instance, prop);
    }
  });
};

// Export a transparent proxy that acts exactly like PrismaClient
export const db: PrismaClient = createPrismaProxy();

// Also export the function for direct access if needed
export { getPrismaClient };

// ADD THIS LINE - Export db as prisma for backward compatibility
export { db as prisma };
