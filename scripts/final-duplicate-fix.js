#!/usr/bin/env node

/**
 * Final Duplicate Fix
 * Consolidates ALL duplicate records by itemName + date combination
 * This will fix the issue where Byron Chai pot has 92 records etc.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeCurrentDuplicates() {
  console.log('🔍 Analyzing current duplicate situation...');
  
  // Get total records
  const totalRecords = await prisma.salesAggregate.count();
  console.log(`Total records: ${totalRecords.toLocaleString()}`);
  
  // Find all items with multiple records (any duplicates)
  const duplicateGroups = await prisma.$queryRaw`
    SELECT 
      item_name,
      COUNT(*) as total_records,
      COUNT(DISTINCT date) as unique_dates,
      ROUND(COUNT(*)::numeric / COUNT(DISTINCT date), 2) as avg_records_per_date
    FROM sales_aggregates 
    WHERE item_name IS NOT NULL 
    GROUP BY item_name
    HAVING COUNT(*) > COUNT(DISTINCT date)
    ORDER BY COUNT(*) DESC
    LIMIT 20;
  `;
  
  console.log(`\nFound ${duplicateGroups.length} items with duplicates:`);
  duplicateGroups.forEach((item, i) => {
    console.log(`${i+1}. "${item.item_name}" - ${item.total_records} records across ${item.unique_dates} dates (${item.avg_records_per_date} avg per date)`);
  });
  
  return duplicateGroups;
}

async function consolidateAllDuplicates(dryRun = true) {
  console.log(`\n${dryRun ? '🧪 DRY RUN' : '⚠️ LIVE'}: Consolidating ALL duplicates by item + date...`);
  
  // Find ALL date+item combinations with multiple records
  const duplicateGroups = await prisma.$queryRaw`
    SELECT 
      date, 
      item_name, 
      category,
      COUNT(*) as record_count,
      SUM(revenue::numeric) as total_revenue,
      SUM(quantity::numeric) as total_quantity,
      SUM(margin::numeric) as total_margin,
      ARRAY_AGG(id ORDER BY id) as all_ids
    FROM sales_aggregates 
    WHERE item_name IS NOT NULL 
    GROUP BY date, item_name, category
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC;
  `;
  
  console.log(`Found ${duplicateGroups.length} date+item groups with duplicates`);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found');
    return;
  }
  
  // Show top duplicates
  console.log('\nTop 15 duplicate groups:');
  duplicateGroups.slice(0, 15).forEach((group, i) => {
    console.log(`${i+1}. ${group.date.toISOString().split('T')[0]} - "${group.item_name}" - ${group.record_count} records → $${group.total_revenue}`);
  });
  
  let totalConsolidated = 0;
  let totalRecordsRemoved = 0;
  
  if (!dryRun) {
    console.log('\n🔧 Starting consolidation...');
    
    for (const group of duplicateGroups) {
      const keepId = group.all_ids[0]; // Keep the first record
      const deleteIds = group.all_ids.slice(1); // Delete the rest
      
      try {
        // Update the kept record with consolidated totals
        await prisma.salesAggregate.update({
          where: { id: keepId },
          data: {
            revenue: parseFloat(group.total_revenue),
            quantity: parseFloat(group.total_quantity),
            margin: group.total_margin ? parseFloat(group.total_margin) : null
          }
        });
        
        // Delete the duplicate records
        await prisma.salesAggregate.deleteMany({
          where: { id: { in: deleteIds } }
        });
        
        totalConsolidated++;
        totalRecordsRemoved += deleteIds.length;
        
        if (totalConsolidated % 100 === 0) {
          console.log(`✅ Consolidated ${totalConsolidated} groups...`);
        }
        
      } catch (error) {
        console.error(`❌ Error consolidating ${group.item_name} on ${group.date}:`, error.message);
      }
    }
    
    console.log(`\n✅ Consolidation complete!`);
    console.log(`📊 Consolidated ${totalConsolidated} groups`);
    console.log(`📉 Removed ${totalRecordsRemoved.toLocaleString()} duplicate records`);
  } else {
    const wouldRemove = duplicateGroups.reduce((sum, group) => sum + (group.record_count - 1), 0);
    console.log(`\n📊 Would consolidate ${duplicateGroups.length} groups`);
    console.log(`📉 Would remove ${wouldRemove.toLocaleString()} duplicate records`);
    console.log('\n💡 To actually fix duplicates, run:');
    console.log('   node scripts/final-duplicate-fix.js --remove');
  }
}

async function main() {
  const dryRun = !process.argv.includes('--remove');
  
  try {
    console.log('=== Final Duplicate Fix ===\n');
    
    await analyzeCurrentDuplicates();
    await consolidateAllDuplicates(dryRun);
    
    if (!dryRun) {
      console.log('\n🔍 Final verification...');
      const newTotal = await prisma.salesAggregate.count();
      console.log(`📊 Final record count: ${newTotal.toLocaleString()}`);
      
      // Quick check for remaining duplicates
      const remainingDuplicates = await prisma.$queryRaw`
        SELECT COUNT(*) as duplicate_groups
        FROM (
          SELECT date, item_name
          FROM sales_aggregates 
          WHERE item_name IS NOT NULL 
          GROUP BY date, item_name
          HAVING COUNT(*) > 1
        ) as duplicates;
      `;
      
      console.log(`🎯 Remaining duplicate groups: ${remainingDuplicates[0].duplicate_groups}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();