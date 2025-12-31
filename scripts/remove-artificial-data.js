#!/usr/bin/env node

/**
 * Remove Artificial Daily Data
 * Removes suspicious items that appear exactly once per day for 80+ consecutive days
 * This artificial pattern inflates revenue and is not realistic sales data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function identifyArtificialData() {
  console.log('🔍 Identifying artificial daily data patterns...');
  
  // Find items with artificial daily patterns (1 record per day for many consecutive days)
  const artificialItems = await prisma.$queryRaw`
    SELECT 
      item_name,
      COUNT(*) as total_records,
      COUNT(DISTINCT date) as unique_dates,
      MIN(date) as first_date,
      MAX(date) as last_date,
      SUM(revenue::numeric) as total_revenue,
      SUM(quantity::numeric) as total_quantity
    FROM sales_aggregates 
    WHERE item_name IS NOT NULL 
    GROUP BY item_name
    HAVING COUNT(*) = COUNT(DISTINCT date) AND COUNT(*) >= 80
    ORDER BY COUNT(*) DESC;
  `;
  
  console.log(`\nFound ${artificialItems.length} items with artificial daily patterns:`);
  console.log('(Items appearing exactly once per day for 80+ consecutive days)');
  
  artificialItems.forEach((item, i) => {
    console.log(`${i+1}. "${item.item_name}"`);
    console.log(`   📅 ${item.total_records} records across ${item.unique_dates} days`);
    console.log(`   💰 $${parseFloat(item.total_revenue).toFixed(2)} total revenue`);
    console.log(`   📦 ${parseFloat(item.total_quantity)} total quantity`);
    console.log('');
  });
  
  return artificialItems;
}

async function removeArtificialData(dryRun = true) {
  const artificialItems = await identifyArtificialData();
  
  if (artificialItems.length === 0) {
    console.log('✅ No artificial data patterns found');
    return;
  }
  
  console.log(`${dryRun ? '🧪 DRY RUN' : '⚠️ LIVE'}: Removing artificial daily data...`);
  
  const totalRecordsToRemove = artificialItems.reduce((sum, item) => sum + Number(item.total_records), 0);
  const totalRevenueToRemove = artificialItems.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0);
  
  console.log(`\n📊 Impact summary:`);
  console.log(`   🗑️ Records to remove: ${totalRecordsToRemove.toLocaleString()}`);
  console.log(`   💰 Revenue to remove: $${totalRevenueToRemove.toLocaleString()}`);
  console.log(`   📦 Items affected: ${artificialItems.length}`);
  
  if (!dryRun) {
    console.log('\n🔧 Starting removal...');
    
    let removedCount = 0;
    for (const item of artificialItems) {
      try {
        const result = await prisma.salesAggregate.deleteMany({
          where: { itemName: item.item_name }
        });
        
        removedCount += result.count;
        console.log(`✅ Removed ${result.count} records for "${item.item_name}"`);
        
      } catch (error) {
        console.error(`❌ Error removing "${item.item_name}":`, error.message);
      }
    }
    
    console.log(`\n✅ Removal complete!`);
    console.log(`📉 Removed ${removedCount.toLocaleString()} artificial records`);
  } else {
    console.log('\n💡 To actually remove artificial data, run:');
    console.log('   node scripts/remove-artificial-data.js --remove');
  }
}

async function showHealthyData() {
  console.log('\n🔍 Sample of remaining healthy data patterns:');
  
  const healthyItems = await prisma.$queryRaw`
    SELECT 
      item_name,
      COUNT(*) as total_records,
      COUNT(DISTINCT date) as unique_dates,
      ROUND(COUNT(*)::numeric / COUNT(DISTINCT date), 2) as avg_per_day
    FROM sales_aggregates 
    WHERE item_name IS NOT NULL 
    GROUP BY item_name
    HAVING COUNT(*) != COUNT(DISTINCT date) OR COUNT(*) < 80
    ORDER BY COUNT(*) DESC
    LIMIT 10;
  `;
  
  healthyItems.forEach((item, i) => {
    console.log(`${i+1}. "${item.item_name}" - ${item.total_records} records / ${item.unique_dates} days = ${item.avg_per_day} avg per day`);
  });
}

async function main() {
  const dryRun = !process.argv.includes('--remove');
  
  try {
    console.log('=== Artificial Data Removal ===\n');
    
    const totalBefore = await prisma.salesAggregate.count();
    console.log(`Total records before: ${totalBefore.toLocaleString()}`);
    
    await removeArtificialData(dryRun);
    
    if (!dryRun) {
      const totalAfter = await prisma.salesAggregate.count();
      console.log(`\n📊 Records after cleanup: ${totalAfter.toLocaleString()}`);
      console.log(`📉 Total removed: ${(totalBefore - totalAfter).toLocaleString()}`);
    }
    
    await showHealthyData();
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();