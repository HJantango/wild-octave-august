import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
      DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0,
      DATABASE_URL_START: process.env.DATABASE_URL?.substring(0, 30) || 'NOT_FOUND',
      // List all environment variables that contain 'DATABASE'
      DATABASE_RELATED: Object.keys(process.env)
        .filter(key => key.includes('DATABASE') || key.includes('POSTGRES'))
        .reduce((acc: Record<string, string>, key) => {
          acc[key] = process.env[key]?.substring(0, 50) || 'undefined';
          return acc;
        }, {}),
      // Railway specific vars
      RAILWAY_VARS: Object.keys(process.env)
        .filter(key => key.startsWith('RAILWAY_'))
        .reduce((acc: Record<string, string>, key) => {
          acc[key] = process.env[key] || 'undefined';
          return acc;
        }, {}),
    };

    return Response.json({
      success: true,
      environment: envVars,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Environment check error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';