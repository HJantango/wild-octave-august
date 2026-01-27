import { NextRequest } from 'next/server';
import { prisma, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vendorName, weeks = 6 } = body;

    if (!vendorName) {
      return createErrorResponse('MISSING_VENDOR', 'Vendor name is required', 400);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return createErrorResponse('CONFIG_ERROR', 'ANTHROPIC_API_KEY not configured', 500);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Fetch sales data for this vendor
    const dailySales = await prisma.squareDailySales.findMany({
      where: {
        vendorName: { contains: vendorName, mode: 'insensitive' },
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate by item across weeks
    const itemMap = new Map<string, {
      name: string;
      weeklyTotals: Map<string, number>;
      totalSold: number;
      totalRevenue: number;
    }>();

    for (const record of dailySales) {
      const key = record.itemName;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: record.itemName,
          weeklyTotals: new Map(),
          totalSold: 0,
          totalRevenue: 0,
        });
      }
      const data = itemMap.get(key)!;
      const qty = Number(record.quantitySold);
      data.totalSold += qty;
      data.totalRevenue += record.grossSalesCents / 100;

      // Get week key
      const weekKey = getWeekKey(new Date(record.date));
      data.weeklyTotals.set(weekKey, (data.weeklyTotals.get(weekKey) || 0) + qty);
    }

    // Fetch wastage data for items from this vendor
    const vendor = await prisma.vendor.findFirst({
      where: { name: { contains: vendorName, mode: 'insensitive' } },
      include: {
        items: {
          select: { id: true, name: true },
        },
      },
    });

    const vendorItemIds = vendor?.items.map(i => i.id) || [];

    const wastageRecords = await prisma.wastageRecord.findMany({
      where: {
        itemId: { in: vendorItemIds },
        adjustmentDate: { gte: startDate, lte: endDate },
      },
      include: { item: { select: { name: true } } },
    });

    // Build wastage summary
    const wastageByItem = new Map<string, { qty: number; cost: number }>();
    for (const wr of wastageRecords) {
      const name = wr.item?.name || wr.itemName;
      const existing = wastageByItem.get(name) || { qty: 0, cost: 0 };
      existing.qty += Number(wr.quantity);
      existing.cost += Number(wr.totalCost);
      wastageByItem.set(name, existing);
    }

    // Prepare data summary for Claude
    const itemSummaries = Array.from(itemMap.values()).map(item => {
      const weeklyValues = Array.from(item.weeklyTotals.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, qty]) => `${week}: ${qty.toFixed(1)}`);

      const avgWeekly = item.totalSold / weeks;
      const wastage = wastageByItem.get(item.name);

      // Calculate trend
      const weeklyQtys = Array.from(item.weeklyTotals.values());
      let trend = 'stable';
      if (weeklyQtys.length >= 2) {
        const firstHalf = weeklyQtys.slice(0, Math.floor(weeklyQtys.length / 2));
        const secondHalf = weeklyQtys.slice(Math.floor(weeklyQtys.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (secondAvg > firstAvg * 1.1) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
      }

      return {
        name: item.name,
        avgWeekly: avgWeekly.toFixed(1),
        totalSold: item.totalSold.toFixed(1),
        totalRevenue: `$${item.totalRevenue.toFixed(2)}`,
        trend,
        weeklyBreakdown: weeklyValues.join(', '),
        wastageQty: wastage?.qty.toFixed(1) || '0',
        wastageCost: wastage ? `$${wastage.cost.toFixed(2)}` : '$0',
        wastageRatio: wastage && item.totalSold > 0
          ? `${((wastage.qty / item.totalSold) * 100).toFixed(1)}%`
          : '0%',
      };
    });

    // Sort by total sold descending
    itemSummaries.sort((a, b) => parseFloat(b.totalSold) - parseFloat(a.totalSold));

    const prompt = `You are an ordering assistant for Wild Octave Organics, a health food shop in Australia. 
Analyze the following ${weeks}-week sales data for vendor "${vendorName}" and provide smart ordering suggestions.

SALES DATA:
${JSON.stringify(itemSummaries, null, 2)}

Based on this data, provide ordering suggestions for each item. Consider:
1. Sales trends (increasing/decreasing/stable)
2. Wastage ratios (if high, suggest reducing orders)
3. Average weekly sales (for baseline quantities)
4. Seasonal patterns if visible

Return a JSON array of suggestions with this structure:
[
  {
    "itemName": "Item Name",
    "action": "increase" | "decrease" | "maintain" | "stop" | "review",
    "suggestedWeeklyQty": number,
    "confidence": "high" | "medium" | "low",
    "reasoning": "Brief explanation",
    "alertLevel": "info" | "warning" | "critical"
  }
]

Be concise but specific. Focus on actionable insights. Return ONLY the JSON array, no other text.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse the AI response
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

    let suggestions;
    try {
      // Try to extract JSON from response
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      suggestions = [{ itemName: 'Parse Error', action: 'review', reasoning: aiText, confidence: 'low', alertLevel: 'info', suggestedWeeklyQty: 0 }];
    }

    return createSuccessResponse({
      vendorName,
      weeksAnalyzed: weeks,
      totalItems: itemSummaries.length,
      suggestions,
      salesSummary: itemSummaries,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ AI order suggestions error:', error);
    return createErrorResponse(
      'AI_ERROR',
      `Failed to generate suggestions: ${error.message}`,
      500
    );
  }
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export const dynamic = 'force-dynamic';
