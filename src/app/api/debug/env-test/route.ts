import { NextRequest } from 'next/server';
import { createSuccessResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    return createSuccessResponse({
      nodeEnv: process.env.NODE_ENV,
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      databaseUrlPreview: process.env.DATABASE_URL?.substring(0, 30) + '...',
      railwayEnv: process.env.RAILWAY_ENVIRONMENT,
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('DATABASE') || key.includes('RAILWAY') || key.includes('PRISMA')
      ).sort(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return createSuccessResponse({
      error: error.message,
      stack: error.stack,
    });
  }
}

export const dynamic = 'force-dynamic';