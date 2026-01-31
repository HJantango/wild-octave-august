#!/usr/bin/env npx tsx
/**
 * Wild Octave Low Stock Alerts
 * 
 * Identifies items running low based on inventory levels and sales velocity.
 * Outputs WhatsApp-friendly alert messages.
 * 
 * Usage:
 *   npm run stock              # Output to stdout (WhatsApp format)
 *   npm run stock -- --json    # Output raw JSON
 *   npm run stock -- --days 14 # Look at 14 days of sales history
 *   npm run stock -- --urgent  # Only critical items
 * 
 * Exit codes:
 *   0 - Alerts found (or --json mode)
 *   1 - Error
 *   2 - No alerts (all stock levels healthy)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

interface LowStockItem {
  itemId: string;
  name: string;
  category: string;
  vendorId: string | null;
  vendorName: string | null;
  currentStock: number;
  reorderPoint: number | null;
  avgDailySales: number;
  daysOfStockRemaining: number | null;
  suggestedReorderQty: number;
  priority: 'critical' | 'warning' | 'watch' | 'ok';
  reason: string;
}

interface LowStockResult {
  timestamp: string;
  periodAnalyzed: string;
  items: LowStockItem[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    watch: number;
  };
}

function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return val.toNumber();
}

function calculatePriority(
  currentStock: number,
  avgDailySales: number,
  reorderPoint: number | null,
  daysOfStock: number | null
): { priority: LowStockItem['priority']; reason: string } {
  if (currentStock <= 0) {
    return { priority: 'critical', reason: '🚨 OUT OF STOCK' };
  }
  
  if (reorderPoint !== null && currentStock <= reorderPoint) {
    return { priority: 'critical', reason: `📉 Below reorder point (${reorderPoint})` };
  }
  
  if (daysOfStock !== null && daysOfStock < 3) {
    return { priority: 'critical', reason: `⏰ Only ${daysOfStock.toFixed(1)} days of stock!` };
  }
  
  if (daysOfStock !== null && daysOfStock < 7) {
    return { priority: 'warning', reason: `⚠️ ${daysOfStock.toFixed(1)} days of stock remaining` };
  }
  
  if (daysOfStock !== null && daysOfStock < 14) {
    return { priority: 'watch', reason: `👀 ${daysOfStock.toFixed(1)} days of stock` };
  }
  
  return { priority: 'ok', reason: 'Stock levels healthy' };
}

function calculateSuggestedReorderQty(
  avgDailySales: number,
  currentStock: number,
  targetDaysOfStock: number = 30
): number {
  if (avgDailySales === 0) return 0;
  
  const currentDays = avgDailySales > 0 ? currentStock / avgDailySales : 0;
  const neededStock = (targetDaysOfStock - currentDays) * avgDailySales;
  
  return Math.max(0, Math.ceil(neededStock));
}

async function generateLowStockAlerts(
  daysAhead: number = 7,
  urgencyDays: number = 14,
  urgentOnly: boolean = false
): Promise<LowStockResult> {
  const now = new Date();
  const aedtOffset = 11 * 60 * 60 * 1000;
  const nowAEDT = new Date(now.getTime() + aedtOffset);
  
  const endDate = new Date(nowAEDT);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(nowAEDT);
  startDate.setDate(startDate.getDate() - daysAhead);
  startDate.setHours(0, 0, 0, 0);
  
  console.error(`📦 Low Stock Alert Check`);
  console.error(`   Analyzing sales from last ${daysAhead} days...`);
  
  // Fetch inventory items with their items and vendors
  const inventoryItems = await prisma.inventoryItem.findMany({
    include: {
      item: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
  
  console.error(`   Found ${inventoryItems.length} inventory items`);
  
  // Fetch recent sales data
  const salesData = await prisma.squareDailySales.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      itemName: true,
      variationName: true,
      quantitySold: true,
      date: true,
    },
  });
  
  console.error(`   Found ${salesData.length} sales records`);
  
  // Aggregate sales by item name
  const salesByItem: Record<string, { totalQty: number; lastSoldDate: Date }> = {};
  for (const sale of salesData) {
    const key = sale.itemName.toLowerCase().trim();
    const qty = toNumber(sale.quantitySold);
    
    if (!salesByItem[key]) {
      salesByItem[key] = { totalQty: 0, lastSoldDate: sale.date };
    }
    salesByItem[key].totalQty += qty;
    if (sale.date > salesByItem[key].lastSoldDate) {
      salesByItem[key].lastSoldDate = sale.date;
    }
  }
  
  const lowStockItems: LowStockItem[] = [];
  
  for (const inv of inventoryItems) {
    const item = inv.item;
    if (!item) continue;
    
    const currentStock = toNumber(inv.currentStock);
    const reorderPoint = inv.reorderPoint ? toNumber(inv.reorderPoint) : null;
    
    // Find sales for this item
    const itemKey = item.name.toLowerCase().trim();
    const sales = salesByItem[itemKey];
    const totalQtySold = sales?.totalQty || 0;
    const avgDailySales = daysAhead > 0 ? totalQtySold / daysAhead : 0;
    
    // Calculate days of stock remaining
    let daysOfStockRemaining: number | null = null;
    if (avgDailySales > 0) {
      daysOfStockRemaining = currentStock / avgDailySales;
    } else if (currentStock > 0) {
      daysOfStockRemaining = null; // Not selling, can't calculate
    }
    
    const { priority, reason } = calculatePriority(
      currentStock,
      avgDailySales,
      reorderPoint,
      daysOfStockRemaining
    );
    
    // Filter based on urgency
    if (urgentOnly && priority !== 'critical') continue;
    
    const needsAttention = priority === 'critical' || 
                           priority === 'warning' ||
                           (priority === 'watch' && daysOfStockRemaining !== null && daysOfStockRemaining < urgencyDays);
    
    if (!needsAttention) continue;
    
    const suggestedReorderQty = calculateSuggestedReorderQty(avgDailySales, currentStock);
    
    lowStockItems.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      vendorId: item.vendorId,
      vendorName: item.vendor?.name || null,
      currentStock: Math.round(currentStock * 10) / 10,
      reorderPoint,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      daysOfStockRemaining: daysOfStockRemaining !== null ? Math.round(daysOfStockRemaining * 10) / 10 : null,
      suggestedReorderQty,
      priority,
      reason,
    });
  }
  
  // Sort by priority then days of stock
  const priorityOrder = { critical: 0, warning: 1, watch: 2, ok: 3 };
  lowStockItems.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    
    const aDays = a.daysOfStockRemaining ?? Infinity;
    const bDays = b.daysOfStockRemaining ?? Infinity;
    return aDays - bDays;
  });
  
  return {
    timestamp: nowAEDT.toISOString(),
    periodAnalyzed: `Last ${daysAhead} days`,
    items: lowStockItems,
    summary: {
      total: lowStockItems.length,
      critical: lowStockItems.filter(i => i.priority === 'critical').length,
      warning: lowStockItems.filter(i => i.priority === 'warning').length,
      watch: lowStockItems.filter(i => i.priority === 'watch').length,
    },
  };
}

function formatWhatsAppMessage(data: LowStockResult): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`📦 *Wild Octave Stock Alert*`);
  lines.push(`📊 Based on ${data.periodAnalyzed.toLowerCase()}`);
  lines.push('');
  
  if (data.items.length === 0) {
    lines.push(`✅ All stock levels looking healthy!`);
    lines.push(`No items need attention right now.`);
    return lines.join('\n');
  }
  
  // Summary
  const { critical, warning, watch } = data.summary;
  if (critical > 0) {
    lines.push(`🚨 *${critical} critical* items need immediate attention`);
  }
  if (warning > 0) {
    lines.push(`⚠️ *${warning} warning* items running low`);
  }
  if (watch > 0) {
    lines.push(`👀 *${watch} watch* items to keep an eye on`);
  }
  lines.push('');
  
  // Group by vendor for actionable ordering
  const byVendor: Record<string, LowStockItem[]> = {};
  for (const item of data.items) {
    const vendor = item.vendorName || 'Unknown Vendor';
    if (!byVendor[vendor]) byVendor[vendor] = [];
    byVendor[vendor].push(item);
  }
  
  // Only show critical and warning in WhatsApp (keep it short)
  const urgentItems = data.items.filter(i => i.priority === 'critical' || i.priority === 'warning');
  
  if (urgentItems.length > 0) {
    lines.push(`*🔴 Needs Action*`);
    
    // Show up to 10 items
    const toShow = urgentItems.slice(0, 10);
    for (const item of toShow) {
      const emoji = item.priority === 'critical' ? '🚨' : '⚠️';
      const stock = item.currentStock === 0 ? 'OUT' : `${item.currentStock}`;
      const days = item.daysOfStockRemaining !== null ? `~${item.daysOfStockRemaining}d` : '';
      const vendor = item.vendorName ? ` (${item.vendorName})` : '';
      
      lines.push(`${emoji} ${item.name}${vendor}`);
      lines.push(`   Stock: ${stock} ${days}`);
      if (item.suggestedReorderQty > 0) {
        lines.push(`   Order: ~${item.suggestedReorderQty} units`);
      }
    }
    
    if (urgentItems.length > 10) {
      lines.push(`\n... and ${urgentItems.length - 10} more items`);
    }
  }
  
  // Quick vendor summary
  lines.push('');
  lines.push(`*📋 By Vendor*`);
  const vendorSummary = Object.entries(byVendor)
    .map(([vendor, items]) => {
      const critCount = items.filter(i => i.priority === 'critical').length;
      const warnCount = items.filter(i => i.priority === 'warning').length;
      const total = critCount + warnCount;
      if (total === 0) return null;
      return `• ${vendor}: ${total} item${total > 1 ? 's' : ''}`;
    })
    .filter((s): s is string => s !== null);
  
  lines.push(...vendorSummary);
  
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const showJson = args.includes('--json');
  const urgentOnly = args.includes('--urgent');
  const daysIdx = args.indexOf('--days');
  const daysAhead = daysIdx !== -1 ? parseInt(args[daysIdx + 1]) : 7;
  
  try {
    const data = await generateLowStockAlerts(daysAhead, 14, urgentOnly);
    
    if (showJson) {
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    }
    
    const message = formatWhatsAppMessage(data);
    console.log(message);
    
    // Exit code: 0 if alerts, 2 if no alerts
    if (data.items.length === 0) {
      process.exit(2);
    }
    
  } catch (error) {
    console.error('❌ Error generating low stock alerts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
