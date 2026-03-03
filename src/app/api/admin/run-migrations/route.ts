import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Running Prisma migrations...');
    
    // Check if we're in production environment
    if (!process.env.DATABASE_URL) {
      return Response.json({ 
        error: 'DATABASE_URL not found',
        env: process.env.NODE_ENV 
      }, { status: 500 });
    }

    console.log('📊 Environment check passed');

    // Generate Prisma client first
    try {
      console.log('🔄 Generating Prisma client...');
      const generateResult = await execAsync('npx prisma generate', {
        env: { ...process.env },
        cwd: process.cwd()
      });
      console.log('✅ Prisma client generated:', generateResult.stdout);
    } catch (genError: any) {
      console.error('❌ Generate error:', genError);
      // Continue anyway - client might already exist
    }

    // Run migrations
    try {
      console.log('🏗️ Running database migrations...');
      const migrateResult = await execAsync('npx prisma migrate deploy', {
        env: { ...process.env },
        cwd: process.cwd(),
        timeout: 60000 // 60 second timeout
      });
      
      console.log('✅ Migration completed:', migrateResult.stdout);
      
      return Response.json({
        success: true,
        message: 'Migrations completed successfully',
        output: migrateResult.stdout,
        timestamp: new Date().toISOString()
      });
      
    } catch (migrateError: any) {
      console.error('❌ Migration error:', migrateError);
      
      return Response.json({
        error: 'Migration failed',
        details: migrateError.message,
        stderr: migrateError.stderr,
        stdout: migrateError.stdout,
        code: migrateError.code
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Endpoint error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';