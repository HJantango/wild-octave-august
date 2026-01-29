import { NextRequest, NextResponse } from 'next/server';
import { realSquareService } from '@/services/real-square-service';

export interface DailyDigestData {
  date: string;
  dateDisplay: string;
  totalSales: number;
  totalOrders: number;
  avgBasketSize: number;
  topSellers: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  comparison?: {
    lastWeekSales: number;
    lastWeekOrders: number;
    salesChange: number;
    salesChangePercent: number;
    ordersChange: number;
    ordersChangePercent: number;
  };
  anomalies: string[];
}

function getDateRange(dateStr?: string): { start: Date; end: Date; display: string } {
  // If date provided, use that; otherwise use yesterday (AEDT)
  const now = new Date();
  // AEDT is UTC+11, so adjust
  const aedtOffset = 11 * 60 * 60 * 1000;
  const aedtNow = new Date(now.getTime() + aedtOffset);
  
  let targetDate: Date;
  if (dateStr) {
    targetDate = new Date(dateStr);
  } else {
    // Yesterday in AEDT
    targetDate = new Date(aedtNow);
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  // Start of day (00:00:00) in AEDT, converted to UTC
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const startUTC = new Date(startOfDay.getTime() - aedtOffset);
  
  // End of day (23:59:59) in AEDT, converted to UTC
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  const endUTC = new Date(endOfDay.getTime() - aedtOffset);
  
  const display = targetDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Australia/Sydney'
  });
  
  return { start: startUTC, end: endUTC, display };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    const includeComparison = searchParams.get('compare') !== 'false';
    
    // Get date ranges
    const { start, end, display } = getDateRange(dateParam || undefined);
    const dateStr = start.toISOString().split('T')[0];
    
    console.log(`📊 Generating daily digest for ${display}`);
    console.log(`   UTC range: ${start.toISOString()} to ${end.toISOString()}`);
    
    // Fetch orders for the target date
    const orders = await realSquareService.searchOrders({
      startDate: start,
      endDate: end,
      limit: 500
    });
    
    console.log(`   Found ${orders.length} orders`);
    
    // Calculate metrics
    const totalSales = orders.reduce((sum, order) => sum + (order.totalMoney.amount / 100), 0);
    const totalOrders = orders.length;
    const avgBasketSize = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Aggregate top sellers
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    for (const order of orders) {
      for (const item of order.lineItems) {
        const name = item.name || item.variationName || 'Unknown Item';
        const qty = parseInt(item.quantity) || 1;
        const revenue = (item.totalMoney.amount / 100);
        
        if (!itemSales[name]) {
          itemSales[name] = { name, quantity: 0, revenue: 0 };
        }
        itemSales[name].quantity += qty;
        itemSales[name].revenue += revenue;
      }
    }
    
    const topSellers = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Comparison with same day last week
    let comparison: DailyDigestData['comparison'] = undefined;
    
    if (includeComparison) {
      const lastWeekStart = new Date(start);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(end);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      
      console.log(`   Comparing to last week: ${lastWeekStart.toISOString()}`);
      
      const lastWeekOrders = await realSquareService.searchOrders({
        startDate: lastWeekStart,
        endDate: lastWeekEnd,
        limit: 500
      });
      
      const lastWeekSales = lastWeekOrders.reduce((sum, order) => sum + (order.totalMoney.amount / 100), 0);
      const lastWeekOrderCount = lastWeekOrders.length;
      
      const salesChange = totalSales - lastWeekSales;
      const salesChangePercent = lastWeekSales > 0 ? (salesChange / lastWeekSales) * 100 : 0;
      const ordersChange = totalOrders - lastWeekOrderCount;
      const ordersChangePercent = lastWeekOrderCount > 0 ? (ordersChange / lastWeekOrderCount) * 100 : 0;
      
      comparison = {
        lastWeekSales,
        lastWeekOrders: lastWeekOrderCount,
        salesChange,
        salesChangePercent,
        ordersChange,
        ordersChangePercent
      };
    }
    
    // Detect anomalies
    const anomalies: string[] = [];
    
    if (comparison) {
      if (comparison.salesChangePercent > 30) {
        anomalies.push(`📈 Sales up ${comparison.salesChangePercent.toFixed(0)}% vs last week!`);
      } else if (comparison.salesChangePercent < -30) {
        anomalies.push(`📉 Sales down ${Math.abs(comparison.salesChangePercent).toFixed(0)}% vs last week`);
      }
      
      if (comparison.ordersChangePercent > 40) {
        anomalies.push(`🔥 Order volume way up (+${comparison.ordersChangePercent.toFixed(0)}%)`);
      } else if (comparison.ordersChangePercent < -40) {
        anomalies.push(`⚠️ Fewer customers than last week (-${Math.abs(comparison.ordersChangePercent).toFixed(0)}%)`);
      }
    }
    
    if (avgBasketSize > 50) {
      anomalies.push(`💰 High average basket: $${avgBasketSize.toFixed(2)}`);
    } else if (avgBasketSize < 15 && totalOrders > 5) {
      anomalies.push(`🛒 Low average basket: $${avgBasketSize.toFixed(2)} - promo opportunity?`);
    }
    
    const digest: DailyDigestData = {
      date: dateStr,
      dateDisplay: display,
      totalSales,
      totalOrders,
      avgBasketSize,
      topSellers,
      comparison,
      anomalies
    };
    
    return NextResponse.json({
      success: true,
      data: digest
    });
    
  } catch (error) {
    console.error('❌ Daily digest error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate digest'
    }, { status: 500 });
  }
}
