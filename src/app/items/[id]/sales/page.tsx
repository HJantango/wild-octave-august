'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

interface ItemSalesPageProps {
  params: Promise<{ id: string }>;
}

const fetchDeepDive = async (itemId: string, gapThreshold: number) => {
  const res = await fetch(`/api/sales/item-deep-dive?itemId=${itemId}&gapThreshold=${gapThreshold}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SalesChart({ timeline, gaps }: { timeline: any[]; gaps: any[] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No sales data available
      </div>
    );
  }

  const maxQuantity = Math.max(...timeline.map(d => d.quantity), 1);
  const chartHeight = 200;

  // Group by week for a cleaner view if we have lots of data
  const displayData = timeline.length > 60 
    ? groupByWeek(timeline)
    : timeline;

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px] h-64 overflow-x-auto pb-8">
        {displayData.map((day, index) => {
          const height = (day.quantity / maxQuantity) * chartHeight;
          const isGap = day.isGap;
          
          return (
            <div
              key={day.date}
              className="flex flex-col items-center group relative"
              style={{ minWidth: timeline.length > 60 ? '12px' : '8px' }}
            >
              <div
                className={`w-full rounded-t transition-all ${
                  isGap 
                    ? 'bg-red-200 border border-red-300 border-dashed' 
                    : day.quantity > 0 
                      ? 'bg-blue-500 hover:bg-blue-600' 
                      : 'bg-gray-200'
                }`}
                style={{ height: `${Math.max(height, isGap ? 20 : 2)}px` }}
              />
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-medium">{formatDate(day.date)}</div>
                  <div>Qty: {day.quantity.toFixed(1)}</div>
                  <div>Revenue: {formatCurrency(day.revenue)}</div>
                  {isGap && <div className="text-red-300">⚠️ Gap period</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 text-sm text-gray-600 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Sales</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-200 border border-red-300 border-dashed rounded" />
          <span>Out of Stock (gap)</span>
        </div>
      </div>
    </div>
  );
}

function groupByWeek(data: any[]): any[] {
  const weeks: Record<string, any> = {};
  
  data.forEach(day => {
    const date = new Date(day.date);
    // Get start of week (Monday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = { date: weekKey, quantity: 0, revenue: 0, isGap: true, gapDays: 0, totalDays: 0 };
    }
    
    weeks[weekKey].quantity += day.quantity;
    weeks[weekKey].revenue += day.revenue;
    weeks[weekKey].totalDays++;
    if (day.isGap) weeks[weekKey].gapDays++;
    // Only mark as gap if majority of week was gap
    if (day.quantity > 0) weeks[weekKey].isGap = false;
  });
  
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date));
}

function WeekdayChart({ data }: { data: any[] }) {
  const maxQty = Math.max(...data.map(d => d.totalQuantity), 1);
  
  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map(day => {
        const height = (day.totalQuantity / maxQty) * 100;
        return (
          <div key={day.dayOfWeek} className="flex flex-col items-center">
            <div className="w-full h-24 flex items-end justify-center">
              <div
                className="w-8 bg-emerald-500 rounded-t"
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>
            <div className="text-xs font-medium mt-1">{day.dayName.slice(0, 3)}</div>
            <div className="text-xs text-gray-500">{day.totalQuantity.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ItemSalesPage({ params }: ItemSalesPageProps) {
  const { id } = use(params);
  const [gapThreshold, setGapThreshold] = useState(3);

  const { data, error, isLoading } = useQuery({
    queryKey: ['item-deep-dive', id, gapThreshold],
    queryFn: () => fetchDeepDive(id, gapThreshold),
  });

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Sales Data</h2>
            <p className="text-gray-600 mb-4">{error.message || 'Failed to load sales analysis'}</p>
            <Link href={`/items/${id}`}>
              <Button>← Back to Item</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading || !data?.data) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing sales history...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const result = data.data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              <Link href={`/items/${id}`}>
                <Button variant="ghost" size="sm">
                  ← Back to Item
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{result.item.name}</h1>
            <p className="text-gray-600 mt-1">Sales Deep Dive</p>
            {result.item.vendor && (
              <Badge variant="outline" className="mt-2">
                {result.item.vendor.name}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Gap threshold:</label>
            <select
              value={gapThreshold}
              onChange={(e) => setGapThreshold(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Total Sold</div>
              <div className="text-2xl font-bold">{result.totals.quantity.toFixed(1)}</div>
              <div className="text-xs text-gray-400">
                {result.dateRange.start && `${formatDate(result.dateRange.start)} → ${formatDate(result.dateRange.end)}`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Total Revenue</div>
              <div className="text-2xl font-bold">{formatCurrency(result.totals.revenue)}</div>
              <div className="text-xs text-gray-400">
                {result.totals.daysWithSales} days with sales
              </div>
            </CardContent>
          </Card>

          <Card className={Number(result.gaps.totalGapDays) > 0 ? 'border-amber-200 bg-amber-50' : ''}>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Availability</div>
              <div className="text-2xl font-bold">{result.gaps.availabilityPercent}%</div>
              <div className="text-xs text-gray-400">
                {result.gaps.totalGapDays > 0 
                  ? `${result.gaps.totalGapDays} days out of stock`
                  : 'Always in stock'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-sm text-blue-700">Adjusted Weekly Avg</div>
              <div className="text-2xl font-bold text-blue-900">
                {result.averages.adjusted.weekly.toFixed(2)}
              </div>
              {Number(result.averages.improvement) > 0 && (
                <div className="text-xs text-blue-600">
                  ↑ {result.averages.improvement}% vs raw average
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sales Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart timeline={result.timeline} gaps={result.gaps.periods} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gap Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚠️ Gap Analysis
                <Badge variant="outline">{gapThreshold}+ day threshold</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.gaps.periods.length === 0 ? (
                <div className="text-center py-6 text-green-600">
                  <div className="text-3xl mb-2">✓</div>
                  <div className="font-medium">No significant gaps detected</div>
                  <div className="text-sm text-gray-500">
                    Product appears to have been consistently in stock
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.gaps.periods.map((gap: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-red-800">
                          {formatDate(gap.startDate)} → {formatDate(gap.endDate)}
                        </div>
                        <div className="text-sm text-red-600">{gap.days} days</div>
                      </div>
                      <Badge variant="destructive">{gap.days} days</Badge>
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total gap days:</span>
                      <span className="font-medium">{result.gaps.totalGapDays}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Available days:</span>
                      <span className="font-medium">{result.gaps.availableDays} / {result.dateRange.totalDays}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Averages Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Averages Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Raw Average (includes gaps)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Daily</div>
                      <div className="text-lg font-semibold text-gray-600">
                        {result.averages.raw.daily.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Weekly</div>
                      <div className="text-lg font-semibold text-gray-600">
                        {result.averages.raw.weekly.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-700 mb-1 font-medium">
                    ✓ Adjusted Average (excludes gaps)
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-blue-500">Daily</div>
                      <div className="text-lg font-bold text-blue-900">
                        {result.averages.adjusted.daily.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-500">Weekly</div>
                      <div className="text-lg font-bold text-blue-900">
                        {result.averages.adjusted.weekly.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {Number(result.averages.improvement) > 0 && (
                  <div className="text-center text-sm text-gray-600">
                    The adjusted average is <span className="font-semibold text-blue-600">{result.averages.improvement}% higher</span> than the raw average
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day of Week Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>📅 Day of Week Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <WeekdayChart data={result.weekdayBreakdown} />
            </CardContent>
          </Card>

          {/* Order Prediction */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle>🛒 Order Prediction (Next 6 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Adjusted Weekly Rate</div>
                    <div className="text-xl font-bold">
                      {result.orderPrediction.adjustedWeeklyRate.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">6-Week Projection</div>
                    <div className="text-xl font-bold">
                      {result.orderPrediction.projectedNeed.toFixed(1)}
                    </div>
                  </div>
                </div>

                {result.orderPrediction.currentStock !== null && (
                  <>
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <div className="text-sm text-amber-700">Current Stock</div>
                      <div className="text-xl font-bold text-amber-900">
                        {result.orderPrediction.currentStock}
                      </div>
                    </div>

                    <div className="p-4 bg-green-100 border-2 border-green-300 rounded-lg">
                      <div className="text-sm text-green-700 font-medium">Suggested Order</div>
                      <div className="text-3xl font-bold text-green-800">
                        {result.orderPrediction.suggestedOrder}
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        ({result.orderPrediction.projectedNeed.toFixed(1)} needed - {result.orderPrediction.currentStock} in stock)
                      </div>
                    </div>
                  </>
                )}

                {result.orderPrediction.currentStock === null && (
                  <div className="p-3 bg-gray-100 rounded-lg text-center text-gray-500">
                    <div className="text-sm">No stock count available</div>
                    <div className="text-xs mt-1">
                      Add inventory tracking to see order suggestions
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
