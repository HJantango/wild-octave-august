import { PrismaClient } from '@prisma/client'

declare global {
  var __globalPrisma__: PrismaClient | undefined
}

// Prevent multiple instances of Prisma Client in development
const prisma = globalThis.__globalPrisma__ ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__globalPrisma__ = prisma
}

// Export as db (main export that other files are trying to import)
export const db = prisma

// Export as prisma for backward compatibility  
export const prisma as any = db

// Also export getPrismaClient for compatibility
export const getPrismaClient = () => db

// Default export
export default db
