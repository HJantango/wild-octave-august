#!/usr/bin/env node

/**
 * Aggressive Duplicate Removal
 * Removes duplicates based on date + item_name only (ignoring small revenue/quantity differences)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicatesByDateAndItem() {
  console.log('🔍 Finding duplicates by date + item_name...');
  
  // Find items that appear multiple times on the same date
  const duplicateGroups = await prisma.$queryRaw`
    SELECT date, item_name, 
           COUNT(*) as record_count,
           ARRAY_AGG(id ORDER BY id) as all_ids,
           SUM(revenue) as total_revenue,
           SUM(quantity) as total_quantity
    FROM sales_aggregates 
    WHERE item_name IS NOT NULL 
    GROUP BY date, item_name
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20;
  `;
  
  console.log(`Found ${duplicateGroups.length} item groups with multiple records per day`);
  
  if (duplicateGroups.length > 0) {
    console.log('\nTop duplicate groups:');
    duplicateGroups.slice(0, 10).forEach((group, index) => {
      console.log(`${index + 1}. ${group.date.toISOString().split('T')[0]} - "${group.item_name}" - ${group.record_count} records - $${group.total_revenue}`);
    });
  }
  
  return duplicateGroups;
}

async function consolidateDuplicates(dryRun = true) {
  const duplicateGroups = await findDuplicatesByDateAndItem();
  
  if (duplicateGroups.length === 0) {
    console.log('No duplicates to consolidate');
    return;
  }
  
  console.log(`\n${dryRun ? '🧪 DRY RUN' : '⚠️ LIVE'}: Will consolidate ${duplicateGroups.length} duplicate groups`);
  
  let totalRecordsToDelete = 0;
  
  for (const group of duplicateGroups) {
    const recordsToDelete = group.record_count - 1; // Keep 1, delete the rest
    totalRecordsToDelete += recordsToDelete;
    
    if (!dryRun) {
      // Get the first record (to keep)
      const keepId = group.all_ids[0];
      const deleteIds = group.all_ids.slice(1);
      
      // Get all the data to sum up
      const allRecords = await prisma.salesAggregate.findMany({
        where: { id: { in: group.all_ids } }
      });
      
      const totalRevenue = allRecords.reduce((sum, r) => sum + Number(r.revenue), 0);
      const totalQuantity = allRecords.reduce((sum, r) => sum + Number(r.quantity), 0);
      const totalMargin = allRecords.reduce((sum, r) => sum + Number(r.margin || 0), 0);
      
      // Update the first record with consolidated totals
      await prisma.salesAggregate.update({
        where: { id: keepId },
        data: {
          revenue: totalRevenue,
          quantity: totalQuantity,
          margin: totalMargin
        }
      });
      
      // Delete the duplicate records
      await prisma.salesAggregate.deleteMany({
        where: { id: { in: deleteIds } }
      });
      
      console.log(`✅ Consolidated ${group.item_name} on ${group.date.toISOString().split('T')[0]}: ${group.record_count} → 1 record`);
    }
  }
  
  console.log(`\nSummary: ${dryRun ? 'Would delete' : 'Deleted'} ${totalRecordsToDelete} duplicate records`);
  
  if (dryRun) {
    console.log('\n💡 To actually remove duplicates, run:');
    console.log('   node scripts/aggressive-dedup.js --remove');
  }
}

async function main() {
  const dryRun = !process.argv.includes('--remove');
  
  try {
    console.log('=== Aggressive Duplicate Removal ===\n');
    
    // Show current stats
    const totalRecords = await prisma.salesAggregate.count();
    console.log(`Current total records: ${totalRecords.toLocaleString()}`);
    
    await consolidateDuplicates(dryRun);
    
    if (!dryRun) {
      const newTotal = await prisma.salesAggregate.count();
      console.log(`\n📊 Records after cleanup: ${newTotal.toLocaleString()}`);
      console.log(`📉 Removed: ${(totalRecords - newTotal).toLocaleString()} duplicate records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();