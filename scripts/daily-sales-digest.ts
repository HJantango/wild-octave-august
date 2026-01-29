/**
 * Wild Octave Daily Sales Digest
 * 
 * Fetches yesterday's sales data from Square and formats a WhatsApp-friendly summary.
 * 
 * Usage:
 *   npx ts-node scripts/daily-sales-digest.ts           # Output to stdout
 *   npx ts-node scripts/daily-sales-digest.ts --send    # Send via Clawdbot (requires CLAWDBOT_URL)
 *   npx ts-node scripts/daily-sales-digest.ts --date 2025-01-28  # Specific date
 */

import { realSquareService, SquareOrder } from '../src/services/real-square-service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface DigestData {
  date: string;
  dateDisplay: string;
  totalSales: number;
  totalOrders: number;
  avgBasketSize: number;
  topSellers: Array<{ name: string; quantity: number; revenue: number }>;
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

function getDateRange(dateStr?: string): { start: Date; end: Date; display: string; dateStr: string } {
  const now = new Date();
  // AEDT is UTC+11
  const aedtOffset = 11 * 60 * 60 * 1000;
  const aedtNow = new Date(now.getTime() + aedtOffset);
  
  let targetDate: Date;
  if (dateStr) {
    targetDate = new Date(dateStr + 'T00:00:00');
  } else {
    targetDate = new Date(aedtNow);
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  // Start of day in AEDT → UTC
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const startUTC = new Date(startOfDay.getTime() - aedtOffset);
  
  // End of day in AEDT → UTC
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  const endUTC = new Date(endOfDay.getTime() - aedtOffset);
  
  const display = targetDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const isoDate = targetDate.toISOString().split('T')[0];
  
  return { start: startUTC, end: endUTC, display, dateStr: isoDate };
}

async function generateDigest(dateStr?: string): Promise<DigestData> {
  const { start, end, display, dateStr: isoDate } = getDateRange(dateStr);
  
  console.error(`📊 Fetching sales data for ${display}...`);
  console.error(`   UTC range: ${start.toISOString()} to ${end.toISOString()}`);
  
  // Fetch orders
  const orders = await realSquareService.searchOrders({
    startDate: start,
    endDate: end,
    limit: 500
  });
  
  console.error(`   Found ${orders.length} orders`);
  
  // Calculate metrics
  const totalSales = orders.reduce((sum, order) => sum + (order.totalMoney.amount / 100), 0);
  const totalOrders = orders.length;
  const avgBasketSize = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  // Top sellers
  const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  
  for (const order of orders) {
    for (const item of order.lineItems) {
      const name = item.name || item.variationName || 'Unknown';
      const qty = parseInt(item.quantity) || 1;
      const revenue = item.totalMoney.amount / 100;
      
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
  
  // Last week comparison
  const lastWeekStart = new Date(start);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(end);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  
  console.error(`   Fetching last week's comparison...`);
  
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
  
  // Anomalies
  const anomalies: string[] = [];
  
  if (Math.abs(salesChangePercent) > 30) {
    if (salesChangePercent > 0) {
      anomalies.push(`📈 Sales up ${salesChangePercent.toFixed(0)}% vs last week!`);
    } else {
      anomalies.push(`📉 Sales down ${Math.abs(salesChangePercent).toFixed(0)}% vs last week`);
    }
  }
  
  if (Math.abs(ordersChangePercent) > 40) {
    if (ordersChangePercent > 0) {
      anomalies.push(`🔥 Customer traffic way up (+${ordersChangePercent.toFixed(0)}%)`);
    } else {
      anomalies.push(`⚠️ Fewer customers than usual (-${Math.abs(ordersChangePercent).toFixed(0)}%)`);
    }
  }
  
  if (avgBasketSize > 50) {
    anomalies.push(`💰 Big baskets today: avg $${avgBasketSize.toFixed(2)}`);
  } else if (avgBasketSize < 15 && totalOrders > 5) {
    anomalies.push(`🛒 Small baskets today — upsell opportunity`);
  }
  
  return {
    date: isoDate,
    dateDisplay: display,
    totalSales,
    totalOrders,
    avgBasketSize,
    topSellers,
    comparison: {
      lastWeekSales,
      lastWeekOrders: lastWeekOrderCount,
      salesChange,
      salesChangePercent,
      ordersChange,
      ordersChangePercent
    },
    anomalies
  };
}

function formatWhatsAppMessage(data: DigestData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`🌿 *Wild Octave Daily Digest*`);
  lines.push(`📅 ${data.dateDisplay}`);
  lines.push('');
  
  // Main metrics
  lines.push(`💵 *Total Sales:* $${data.totalSales.toFixed(2)}`);
  lines.push(`🧾 *Orders:* ${data.totalOrders}`);
  lines.push(`🛒 *Avg Basket:* $${data.avgBasketSize.toFixed(2)}`);
  
  // Comparison
  if (data.comparison) {
    const { salesChange, salesChangePercent } = data.comparison;
    const arrow = salesChange >= 0 ? '↑' : '↓';
    const sign = salesChange >= 0 ? '+' : '';
    lines.push(`📊 *vs Last Week:* ${sign}$${salesChange.toFixed(2)} (${sign}${salesChangePercent.toFixed(0)}%) ${arrow}`);
  }
  
  lines.push('');
  
  // Top sellers
  if (data.topSellers.length > 0) {
    lines.push(`🏆 *Top 5 Sellers*`);
    data.topSellers.forEach((item, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      lines.push(`${medal} ${item.name} — ${item.quantity}x ($${item.revenue.toFixed(2)})`);
    });
    lines.push('');
  }
  
  // Anomalies/highlights
  if (data.anomalies.length > 0) {
    lines.push(`💡 *Highlights*`);
    data.anomalies.forEach(a => lines.push(a));
  }
  
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldSend = args.includes('--send');
  const dateIdx = args.indexOf('--date');
  const dateStr = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
  
  try {
    // Connect to Square
    const connected = await realSquareService.connect();
    if (!connected) {
      console.error('❌ Failed to connect to Square API');
      process.exit(1);
    }
    
    // Generate digest
    const data = await generateDigest(dateStr);
    const message = formatWhatsAppMessage(data);
    
    if (shouldSend) {
      // Send via Clawdbot (to be implemented via cron job or direct API)
      console.log('📤 Message ready to send:');
      console.log('---');
      console.log(message);
      console.log('---');
      console.log('\n💡 To send: set up a Clawdbot cron job that runs this script and sends the output to Heath via WhatsApp.');
    } else {
      // Just output the message
      console.log(message);
    }
    
    // Also output JSON for debugging
    if (args.includes('--json')) {
      console.error('\n📋 Raw data:');
      console.error(JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error generating digest:', error);
    process.exit(1);
  }
}

main();
