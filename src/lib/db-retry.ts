import { PrismaClient } from '@prisma/client';

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a database connection error
      const isConnectionError = 
        error instanceof Error &&
        (error.message.includes('fetch failed') ||
         error.message.includes('Cannot fetch data from service') ||
         error.message.includes('Connection terminated') ||
         error.message.includes('ECONNREFUSED'));

      // If it's not a connection error, don't retry
      if (!isConnectionError) {
        throw error;
      }

      console.log(`Database connection attempt ${attempt} failed:`, error.message);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} database connection attempts failed`);
        break;
      }

      // Wait before retrying
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }

  throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError.message}`);
}

export async function testDatabaseConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}