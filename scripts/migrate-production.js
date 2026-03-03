const { execSync } = require('child_process');

console.log('🚀 Running production migration...');

try {
  // Check environment
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL found');
  console.log('📊 Database host:', dbUrl.includes('railway.internal') ? 'Railway internal' : 'External');

  // Generate Prisma client
  console.log('🔄 Generating Prisma client...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated');
  } catch (error) {
    console.log('⚠️ Generate failed, continuing...');
  }

  // Deploy migrations
  console.log('🏗️ Deploying migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations deployed successfully');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}