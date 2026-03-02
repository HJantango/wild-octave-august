import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return Response.json({
    timestamp: new Date().toISOString(),
    databaseUrlExists: !!process.env.DATABASE_URL,
    databaseUrlLength: process.env.DATABASE_URL?.length || 0,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) || 'MISSING',
    nodeEnv: process.env.NODE_ENV,
    railwayEnv: process.env.RAILWAY_ENVIRONMENT,
    prismaUrl: process.env.PRISMA_URL || 'Not set',
    directUrl: process.env.DIRECT_URL || 'Not set',
    test: 'Environment variable access test'
  });
}

export const dynamic = 'force-dynamic';