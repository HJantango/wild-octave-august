#!/usr/bin/env node

/**
 * Clear All Artificial Data
 * Since the entire dataset shows artificial daily patterns, clear it all
 * to allow fresh upload of real sales data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllArtificialData(dryRun = true) {
  console.log('🔍 Analyzing remaining data...');
  
  const totalRecords = await prisma.salesAggregate.count();
  const totalRevenue = await prisma.salesAggregate.aggregate({
    _sum: { revenue: true }
  });
  
  console.log(`Current database state:`);
  console.log(`📊 Total records: ${totalRecords.toLocaleString()}`);
  console.log(`💰 Total revenue: $${totalRevenue._sum.revenue?.toLocaleString() || 0}`);
  
  // Check if all remaining data has artificial patterns
  const itemAnalysis = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN record_count = unique_dates THEN 1 ELSE 0 END) as artificial_items
    FROM (
      SELECT 
        item_name,
        COUNT(*) as record_count,
        COUNT(DISTINCT date) as unique_dates
      FROM sales_aggregates 
      WHERE item_name IS NOT NULL 
      GROUP BY item_name
    ) item_stats;
  `;
  
  const analysis = itemAnalysis[0];
  console.log(`\n📈 Data pattern analysis:`);
  console.log(`   📦 Total unique items: ${Number(analysis.total_items)}`);
  console.log(`   🤖 Items with artificial patterns: ${Number(analysis.artificial_items)}`);
  console.log(`   📊 Artificial percentage: ${(Number(analysis.artificial_items) / Number(analysis.total_items) * 100).toFixed(1)}%`);
  
  if (Number(analysis.artificial_items) / Number(analysis.total_items) > 0.95) {
    console.log('\n⚠️ 95%+ of data shows artificial patterns - recommending full cleanup');
    
    console.log(`\n${dryRun ? '🧪 DRY RUN' : '⚠️ LIVE'}: Clearing all artificial sales data...`);
    
    if (!dryRun) {
      console.log('🔧 Clearing sales_aggregates table...');
      
      const result = await prisma.salesAggregate.deleteMany({});
      
      console.log(`✅ Cleared ${result.count.toLocaleString()} records`);
      console.log('🎯 Database is now clean and ready for real sales data upload');
      
      // Verify cleanup
      const remainingRecords = await prisma.salesAggregate.count();
      console.log(`📊 Remaining records: ${remainingRecords}`);
      
    } else {
      console.log(`\n📊 Would clear all ${totalRecords.toLocaleString()} records`);
      console.log(`💰 Would remove $${totalRevenue._sum.revenue?.toLocaleString() || 0} in artificial revenue`);
      console.log('\n💡 To clear all artificial data, run:');
      console.log('   node scripts/clear-all-artificial.js --clear');
    }
  } else {
    console.log('\n✅ Some data appears to have realistic patterns - manual review recommended');
  }
}

async function main() {
  const dryRun = !process.argv.includes('--clear');
  
  try {
    console.log('=== Clear All Artificial Data ===\n');
    
    await clearAllArtificialData(dryRun);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();