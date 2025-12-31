#!/usr/bin/env node

/**
 * Real Duplicate Fixer
 * This addresses the actual duplicate issue where items have 50-90+ records per day
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeSpecificItem() {
  console.log('🔍 Analyzing Byron Chai pot on Aug 19 (known duplicate)...');
  
  const records = await prisma.salesAggregate.findMany({
    where: {
      date: new Date('2025-08-19'),
      itemName: 'Byron Chai pot'
    },
    select: {
      id: true,
      revenue: true,
      quantity: true,
      margin: true,
      category: true
    },
    orderBy: { id: 'asc' }
  });
  
  console.log(`Found ${records.length} records for Byron Chai pot on Aug 19`);
  console.log('Sample records:');
  records.slice(0, 5).forEach((record, i) => {
    console.log(`  ${i+1}. ID: ${record.id}, Revenue: $${record.revenue}, Qty: ${record.quantity}, Category: ${record.category}`);
  });
  
  if (records.length > 5) {
    console.log('  ... and', records.length - 5, 'more similar records');
  }
  
  return records;
}

async function consolidateItemDuplicates(dryRun = true) {
  console.log(`\n${dryRun ? '🧪 DRY RUN' : '⚠️ LIVE'}: Consolidating item duplicates...`);
  
  // Find all date+item combinations with multiple records
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
    HAVING COUNT(*) > 10
    ORDER BY COUNT(*) DESC;
  `;
  
  console.log(`Found ${duplicateGroups.length} groups with 10+ duplicate records`);
  
  if (duplicateGroups.length === 0) {
    console.log('No significant duplicates found');
    return;
  }
  
  console.log('\nTop 10 duplicate groups:');
  duplicateGroups.slice(0, 10).forEach((group, i) => {
    console.log(`${i+1}. ${group.date.toISOString().split('T')[0]} - "${group.item_name}" - ${group.record_count} records`);
  });
  
  if (!dryRun) {
    console.log('\n🔧 Starting consolidation...');
    
    for (const group of duplicateGroups) {
      const keepId = group.all_ids[0]; // Keep the first record
      const deleteIds = group.all_ids.slice(1); // Delete the rest
      
      // Update the kept record with consolidated totals
      await prisma.salesAggregate.update({
        where: { id: keepId },
        data: {
          revenue: parseFloat(group.total_revenue),
          quantity: parseFloat(group.total_quantity),
          margin: parseFloat(group.total_margin)
        }
      });
      
      // Delete the duplicate records in batches
      const batchSize = 1000;
      for (let i = 0; i < deleteIds.length; i += batchSize) {
        const batch = deleteIds.slice(i, i + batchSize);
        await prisma.salesAggregate.deleteMany({
          where: { id: { in: batch } }
        });
      }
      
      console.log(`✅ Consolidated "${group.item_name}" on ${group.date.toISOString().split('T')[0]}: ${group.record_count} → 1 record`);
    }
  }
  
  const totalToDelete = duplicateGroups.reduce((sum, group) => sum + (group.record_count - 1), 0);
  console.log(`\n📊 Summary: ${dryRun ? 'Would delete' : 'Deleted'} ${totalToDelete.toLocaleString()} duplicate records`);
  
  if (dryRun) {
    console.log('\n💡 To actually fix duplicates, run:');
    console.log('   node scripts/fix-real-duplicates.js --remove');
  }
}

async function main() {
  const dryRun = !process.argv.includes('--remove');
  
  try {
    console.log('=== Real Duplicate Fixer ===\n');
    
    const totalBefore = await prisma.salesAggregate.count();
    console.log(`Total records before: ${totalBefore.toLocaleString()}`);
    
    await analyzeSpecificItem();
    await consolidateItemDuplicates(dryRun);
    
    if (!dryRun) {
      const totalAfter = await prisma.salesAggregate.count();
      console.log(`\n📊 Final count: ${totalAfter.toLocaleString()} records`);
      console.log(`📉 Removed: ${(totalBefore - totalAfter).toLocaleString()} duplicates`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();