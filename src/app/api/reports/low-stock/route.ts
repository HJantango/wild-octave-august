import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * GET /api/reports/low-stock
 * 
 * Identifies items running low based on current stock, reorder points,
 * and recent sales velocity. Proactively warns before stockout.
 * 
 * Query params:
 *   - daysAhead: How many days of sales to consider for velocity (default: 7)
 *   - urgencyDays: Show items with less than N days of stock (default: 14)
 *   - includeNoStock: Include items with no inventory tracking (default: false)
 *   - vendorId: Filter by vendor
 *   - category: Filter by category
 */

interface LowStockItem {
  itemId: string;
  name: string;
  category: string;
  vendorId: string | null;
  vendorName: string | null;
  currentStock: number;
  reorderPoint: number | null;
  minimumStock: number | null;
  avgDailySales: number;
  daysOfStockRemaining: number | null;
  suggestedReorderQty: number;
  priority: 'critical' | 'warning' | 'watch' | 'ok';
  reason: string;
  lastSoldDate: string | null;
}

interface LowStockSummary {
  timestamp: string;
  timezone: string;
  periodAnalyzed: string;
  items: LowStockItem[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    watch: number;
  };
}

function toNumber(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : val.toNumber();
}

function calculatePriority(
  currentStock: number,
  avgDailySales: number,
  reorderPoint: number | null,
  daysOfStock: number | null
): { priority: LowStockItem['priority']; reason: string } {
  // Out of stock
  if (currentStock <= 0) {
    return { priority: 'critical', reason: '🚨 OUT OF STOCK' };
  }
  
  // Below reorder point
  if (reorderPoint !== null && currentStock <= reorderPoint) {
    return { priority: 'critical', reason: `📉 Below reorder point (${reorderPoint})` };
  }
  
  // Very low days of stock (< 3 days)
  if (daysOfStock !== null && daysOfStock < 3) {
    return { priority: 'critical', reason: `⏰ Only ${daysOfStock.toFixed(1)} days of stock!` };
  }
  
  // Low days of stock (< 7 days)
  if (daysOfStock !== null && daysOfStock < 7) {
    return { priority: 'warning', reason: `⚠️ ${daysOfStock.toFixed(1)} days of stock remaining` };
  }
  
  // Watch items (< 14 days)
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
  
  // Round up to reasonable quantities
  return Math.max(0, Math.ceil(neededStock));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysAhead = parseInt(searchParams.get('daysAhead') || '7');
    const urgencyDays = parseInt(searchParams.get('urgencyDays') || '14');
    const includeNoStock = searchParams.get('includeNoStock') === 'true';
    const vendorIdFilter = searchParams.get('vendorId');
    const categoryFilter = searchParams.get('category');
    
    // Get current time in AEDT (UTC+11)
    const now = new Date();
    const aedtOffset = 11 * 60 * 60 * 1000;
    const nowAEDT = new Date(now.getTime() + aedtOffset);
    
    // Calculate date range for sales velocity
    const endDate = new Date(nowAEDT);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(nowAEDT);
    startDate.setDate(startDate.getDate() - daysAhead);
    startDate.setHours(0, 0, 0, 0);
    
    console.log(`📦 Low Stock Alert Check`);
    console.log(`   Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Fetch inventory items with their items and vendors
    const whereClause: any = {};
    if (vendorIdFilter) {
      whereClause.item = { vendorId: vendorIdFilter };
    }
    
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: whereClause,
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
    
    // Fetch recent sales data from SquareDailySales
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
    
    // Aggregate sales by item name (lowercase for matching)
    const salesByItem: Record<string, { totalQty: number; lastSoldDate: Date }> = {};
    for (const sale of salesData) {
      // Try to match by name (fuzzy)
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
      
      // Apply category filter
      if (categoryFilter && item.category !== categoryFilter) continue;
      
      const currentStock = toNumber(inv.currentStock);
      const reorderPoint = inv.reorderPoint ? toNumber(inv.reorderPoint) : null;
      const minimumStock = inv.minimumStock ? toNumber(inv.minimumStock) : null;
      
      // Find sales for this item (case-insensitive)
      const itemKey = item.name.toLowerCase().trim();
      const sales = salesByItem[itemKey];
      const totalQtySold = sales?.totalQty || 0;
      const avgDailySales = daysAhead > 0 ? totalQtySold / daysAhead : 0;
      
      // Calculate days of stock remaining
      let daysOfStockRemaining: number | null = null;
      if (avgDailySales > 0) {
        daysOfStockRemaining = currentStock / avgDailySales;
      } else if (currentStock > 0) {
        daysOfStockRemaining = Infinity; // Not selling, but have stock
      }
      
      const { priority, reason } = calculatePriority(
        currentStock,
        avgDailySales,
        reorderPoint,
        daysOfStockRemaining === Infinity ? null : daysOfStockRemaining
      );
      
      // Only include items that need attention (based on urgencyDays)
      const needsAttention = priority === 'critical' || 
                             priority === 'warning' ||
                             (priority === 'watch' && daysOfStockRemaining !== null && daysOfStockRemaining < urgencyDays);
      
      if (!needsAttention && !includeNoStock) continue;
      
      const suggestedReorderQty = calculateSuggestedReorderQty(avgDailySales, currentStock);
      
      lowStockItems.push({
        itemId: item.id,
        name: item.name,
        category: item.category,
        vendorId: item.vendorId,
        vendorName: item.vendor?.name || null,
        currentStock,
        reorderPoint,
        minimumStock,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        daysOfStockRemaining: daysOfStockRemaining === Infinity ? null : 
                               daysOfStockRemaining !== null ? Math.round(daysOfStockRemaining * 10) / 10 : null,
        suggestedReorderQty,
        priority,
        reason,
        lastSoldDate: sales?.lastSoldDate?.toISOString().split('T')[0] || null,
      });
    }
    
    // Sort by priority (critical > warning > watch) then by days of stock
    const priorityOrder = { critical: 0, warning: 1, watch: 2, ok: 3 };
    lowStockItems.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      
      // Within same priority, sort by days of stock (null = Infinity)
      const aDays = a.daysOfStockRemaining ?? Infinity;
      const bDays = b.daysOfStockRemaining ?? Infinity;
      return aDays - bDays;
    });
    
    const response: LowStockSummary = {
      timestamp: nowAEDT.toISOString(),
      timezone: 'AEDT (UTC+11)',
      periodAnalyzed: `Last ${daysAhead} days`,
      items: lowStockItems,
      summary: {
        total: lowStockItems.length,
        critical: lowStockItems.filter(i => i.priority === 'critical').length,
        warning: lowStockItems.filter(i => i.priority === 'warning').length,
        watch: lowStockItems.filter(i => i.priority === 'watch').length,
      },
    };
    
    return createSuccessResponse(response);
  } catch (error: any) {
    console.error('Error fetching low stock alerts:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      `Failed to fetch low stock alerts: ${error.message}`,
      500
    );
  }
}

export const dynamic = 'force-dynamic';
