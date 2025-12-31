#!/usr/bin/env node

/**
 * Duplicate Removal Utility
 * 
 * This script helps identify and remove duplicate sales data from the database.
 * Run this if you suspect duplicate data has been imported.
 * 
 * Usage: node scripts/remove-duplicates.js [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkForDuplicates() {
  console.log('🔍 Analyzing database for potential duplicates...');
  
  // Check for suspiciously doubled data by comparing a sample date
  const sampleDate = new Date('2025-08-19'); // Known date with data
  
  const sampleData = await prisma.salesAggregate.aggregate({
    where: { date: sampleDate },
    _sum: { revenue: true },
    _count: { id: true },
  });
  
  console.log(`Sample date (Aug 19): ${sampleData._count.id} records, $${sampleData._sum.revenue}`);
  
  // Check total records
  const totalRecords = await prisma.salesAggregate.count();
  console.log(`Total database records: ${totalRecords.toLocaleString()}`);
  
  // Look for exact duplicate patterns
  const duplicateGroups = await prisma.$queryRaw`
    SELECT date, category, item_name, revenue, quantity, COUNT(*) as count
    FROM sales_aggregates 
    GROUP BY date, category, item_name, revenue, quantity
    HAVING COUNT(*) > 1
    LIMIT 10;
  `;
  
  if (duplicateGroups.length > 0) {
    console.log('\n⚠️  Found potential duplicate groups:');
    duplicateGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.date.toISOString().split('T')[0]} - ${group.category || 'null'} - ${group.item_name || 'null'} - $${group.revenue} (${group.count} copies)`);
    });
    return true;
  } else {
    console.log('\n✅ No exact duplicate groups found');
    return false;
  }
}

async function removeDuplicates(dryRun = true) {
  if (dryRun) {
    console.log('\n🧪 DRY RUN MODE - No changes will be made');
  } else {
    console.log('\n⚠️  LIVE MODE - Changes will be applied to database');
  }
  
  // Find duplicate groups and remove extras
  const duplicateGroups = await prisma.$queryRaw`
    SELECT date, category, item_name, revenue, quantity, 
           ARRAY_AGG(id ORDER BY id) as ids,
           COUNT(*) as count
    FROM sales_aggregates 
    GROUP BY date, category, item_name, revenue, quantity
    HAVING COUNT(*) > 1;
  `;
  
  if (duplicateGroups.length === 0) {
    console.log('No duplicates to remove');
    return;
  }
  
  console.log(`Found ${duplicateGroups.length} duplicate groups`);
  
  let totalToDelete = 0;
  const idsToDelete = [];
  
  duplicateGroups.forEach(group => {
    // Keep the first ID, delete the rest
    const extras = group.ids.slice(1);
    idsToDelete.push(...extras);
    totalToDelete += extras.length;
  });
  
  console.log(`Will delete ${totalToDelete} duplicate records`);
  
  if (!dryRun && idsToDelete.length > 0) {
    // Delete in batches
    const batchSize = 1000;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      await prisma.salesAggregate.deleteMany({
        where: { id: { in: batch } }
      });
      console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
    }
    console.log(`✅ Successfully removed ${totalToDelete} duplicate records`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.length === 2;
  
  try {
    console.log('=== Wild Octave Duplicate Removal Tool ===\n');
    
    const hasDuplicates = await checkForDuplicates();
    
    if (hasDuplicates) {
      await removeDuplicates(dryRun);
      
      if (dryRun) {
        console.log('\n💡 To actually remove duplicates, run:');
        console.log('   node scripts/remove-duplicates.js --remove');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Make sure --remove flag actually runs removal
if (process.argv.includes('--remove')) {
  process.argv = process.argv.filter(arg => arg !== '--dry-run');
}

main();