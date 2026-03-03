import { PrismaClient } from '@prisma/client';

// Global singleton pattern for Prisma client to prevent connection leaks
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with explicit DATABASE_URL handling for Railway
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Initializing Prisma client with DATABASE_URL:', databaseUrl.substring(0, 50) + '...');

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  });
}

// Export the singleton prisma instance
export const prisma = globalThis.__prisma ?? createPrismaClient();

// In development, store on globalThis to prevent hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Gracefully disconnect Prisma on process exit
const shutdown = async () => {
  console.log('Shutting down Prisma client...');
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

export default prisma;