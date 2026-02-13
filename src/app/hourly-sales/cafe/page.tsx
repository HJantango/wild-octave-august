'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { ClockIcon, TrendingUpIcon, CoffeeIcon, UtensilsIcon, CalendarIcon, DownloadIcon } from 'lucide-react';
import { HourlyDayChart } from '@/components/charts/hourly-day-chart';
import Link from 'next/link';

interface HourlyData {
  hour: number;
  hourLabel: string;
  days: {
    [key: string]: {
      avgRevenue: number;
      avgFood: number;
      avgDrink: number;
      avgItems: number;
      totalRevenue: number;
    };
  };
  overallAvg: number;
  foodAvg: number;
  drinkAvg: number;
  totalRevenue: number;
}

interface TopItem {
  name: string;
  count: number;
  revenue: number;
  category: string;
}

interface CafeReport {
  dateRange: {
    from: string;
    to: string;
    weeks: number;
  };
  filterType: string;
  summary: {
    totalCafeItems: number;
    totalCafeRevenue: number;
    totalFoodRevenue: number;
    totalDrinkRevenue: number;
    foodPercent: number;
    drinkPercent: number;
  };
  hourlyData: HourlyData[];
  dailySummary: {
    [key: string]: {
      avgDailyRevenue: number;
      avgFood: number;
      avgDrink: number;
      uniqueDays: number;
    };
  };
  topItems: TopItem[];
  insights: {
    peakHours: string[];
    quietHours: string[];
    busiestDay: string;
    quietestDay: string;
  };
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CafeHourlySalesPage() {
  const [data, setData] = useState<CafeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState('12');
  const [filterType, setFilterType] = useState<'all' | 'food' | 'drink'>('all');
  const [viewMode, setViewMode] = useState<'total' | 'food' | 'drink'>('total');
  const [error, setError] = useState<string | null>(null);

  const exportToCSV = () => {
    if (!data) return;
    
    // Build CSV content with food/drink breakdown
    const headers = ['Hour', ...DAY_ORDER.map(d => `${d} Total`), ...DAY_ORDER.map(d => `${d} Food`), ...DAY_ORDER.map(d => `${d} Drink`), 'Avg Total', 'Avg Food', 'Avg Drink'];
    const rows = data.hourlyData.map(h => [
      h.hourLabel,
      ...DAY_ORDER.map(day => h.days[day]?.avgRevenue?.toFixed(2) || '0'),
      ...DAY_ORDER.map(day => h.days[day]?.avgFood?.toFixed(2) || '0'),
      ...DAY_ORDER.map(day => h.days[day]?.avgDrink?.toFixed(2) || '0'),
      h.overallAvg?.toFixed(2) || '0',
      h.foodAvg?.toFixed(2) || '0',
      h.drinkAvg?.toFixed(2) || '0',
    ]);
    
    // Add daily totals row
    rows.push([
      'Day Total',
      ...DAY_ORDER.map(day => data.dailySummary[day]?.avgDailyRevenue?.toFixed(2) || '0'),
      ...DAY_ORDER.map(day => data.dailySummary[day]?.avgFood?.toFixed(2) || '0'),
      ...DAY_ORDER.map(day => data.dailySummary[day]?.avgDrink?.toFixed(2) || '0'),
      '', '', ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafe-hourly-sales-${weeks}wks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/hourly-sales-cafe?weeks=${weeks}&type=${filterType}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load data');
      }
    } catch (err) {
      setError('Failed to fetch cafe sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [weeks, filterType]);

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return 'bg-gray-100';
    const intensity = value / max;
    if (intensity > 0.75) return 'bg-amber-500 text-white';
    if (intensity > 0.5) return 'bg-amber-400 text-white';
    if (intensity > 0.25) return 'bg-amber-300';
    return 'bg-amber-200';
  };

  const getValue = (dayData: any) => {
    if (viewMode === 'food') return dayData.avgFood;
    if (viewMode === 'drink') return dayData.avgDrink;
    return dayData.avgRevenue;
  };

  const maxAvgRevenue = data?.hourlyData.reduce((max, h) => {
    const dayMax = Math.max(...Object.values(h.days).map(d => getValue(d)));
    return Math.max(max, dayMax);
  }, 0) || 100;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <span className="ml-3 text-gray-600">Loading cafe sales data (this may take a moment)...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">☕ Cafe Hourly Sales</h1>
                <p className="text-amber-100 text-lg">
                  Cafe food & drinks — peak times for staffing
                </p>
                {data && (
                  <p className="text-amber-200 text-sm mt-1">
                    {data.dateRange.from} to {data.dateRange.to} • {data.summary.totalCafeItems.toLocaleString()} cafe items
                  </p>
                )}
              </div>
              <div className="mt-4 lg:mt-0 flex flex-wrap items-center gap-2">
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger className="w-32 bg-white/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 weeks</SelectItem>
                    <SelectItem value="8">8 weeks</SelectItem>
                    <SelectItem value="12">12 weeks</SelectItem>
                    <SelectItem value="26">6 months</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                  <SelectTrigger className="w-32 bg-white/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">All Cafe</SelectItem>
                    <SelectItem value="food">Food Only</SelectItem>
                    <SelectItem value="drink">Drinks Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={fetchData}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  ↻ Refresh
                </Button>
                <Link href="/hourly-sales">
                  <Button className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                    📊 All Sales
                  </Button>
                </Link>
                <Button 
                  onClick={exportToCSV}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  disabled={!data}
                >
                  <DownloadIcon className="w-4 h-4 mr-1" /> CSV
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-100 text-sm font-medium">Total Cafe Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.summary.totalCafeRevenue)}</p>
                      <p className="text-amber-100 text-xs mt-1">Over {data.dateRange.weeks} weeks</p>
                    </div>
                    <CoffeeIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium">Food Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.summary.totalFoodRevenue)}</p>
                      <p className="text-red-100 text-xs mt-1">{data.summary.foodPercent}% of cafe</p>
                    </div>
                    <UtensilsIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Drinks Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.summary.totalDrinkRevenue)}</p>
                      <p className="text-blue-100 text-xs mt-1">{data.summary.drinkPercent}% of cafe</p>
                    </div>
                    <CoffeeIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">Peak Hours</p>
                      <p className="text-2xl font-bold">{data.insights.peakHours.slice(0, 2).join(', ')}</p>
                      <p className="text-green-100 text-xs mt-1">Busiest cafe times</p>
                    </div>
                    <TrendingUpIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Busiest Day</p>
                      <p className="text-2xl font-bold">{data.insights.busiestDay}</p>
                      <p className="text-purple-100 text-xs mt-1">
                        {formatCurrency(data.dailySummary[data.insights.busiestDay]?.avgDailyRevenue || 0)} avg
                      </p>
                    </div>
                    <CalendarIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Day-of-Week Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📈</span>
                  <span>
                    {viewMode === 'food' ? 'Food' : viewMode === 'drink' ? 'Drinks' : 'Cafe'} Trends by Day of Week
                  </span>
                </CardTitle>
                <CardDescription>
                  Compare hourly patterns across different days — {data.dateRange.weeks} weeks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyDayChart 
                  data={data.hourlyData.map(h => {
                    // Calculate overall items avg from days
                    const daysArray = Object.values(h.days);
                    const overallItems = daysArray.reduce((sum, d) => sum + (d.avgItems || 0), 0) / daysArray.length;
                    return {
                      ...h,
                      days: Object.fromEntries(
                        Object.entries(h.days).map(([day, d]) => [
                          day,
                          {
                            ...d,
                            avgRevenue: viewMode === 'food' ? d.avgFood : viewMode === 'drink' ? d.avgDrink : d.avgRevenue,
                            avgOrders: d.avgItems || 0
                          }
                        ])
                      ),
                      overallAvg: viewMode === 'food' ? h.foodAvg : viewMode === 'drink' ? h.drinkAvg : h.overallAvg,
                      overallOrders: overallItems
                    };
                  })}
                  height={400}
                  title={`${viewMode === 'food' ? 'Food' : viewMode === 'drink' ? 'Drinks' : 'Food & Drinks'} - ${data.dateRange.weeks} Weeks`}
                  colorScheme="cafe"
                  showTransactions={true}
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                  Solid lines = revenue ($) • Dotted lines = items sold (right axis)
                </p>
              </CardContent>
            </Card>

            {/* Heatmap Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📊</span>
                  <span>
                    {viewMode === 'food' ? 'Food' : viewMode === 'drink' ? 'Drinks' : 'Cafe'} Sales by Hour
                  </span>
                </CardTitle>
                <CardDescription>
                  Darker orange = higher average sales. Toggle between Food/Drinks above.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-semibold">Hour</th>
                        {DAY_ORDER.map(day => (
                          <th key={day} className="px-3 py-2 text-center font-semibold">{day}</th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold bg-gray-100">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hourlyData.map((hourRow) => (
                        <tr key={hourRow.hour} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{hourRow.hourLabel}</td>
                          {DAY_ORDER.map(day => {
                            const dayData = hourRow.days[day];
                            const value = getValue(dayData);
                            return (
                              <td 
                                key={day} 
                                className={`px-3 py-2 text-center ${getHeatmapColor(value, maxAvgRevenue)}`}
                                title={`Food: ${formatCurrency(dayData.avgFood)}, Drinks: ${formatCurrency(dayData.avgDrink)}`}
                              >
                                {value > 0 ? formatCurrency(value) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold bg-gray-100">
                            {viewMode === 'food' ? formatCurrency(hourRow.foodAvg) :
                             viewMode === 'drink' ? formatCurrency(hourRow.drinkAvg) :
                             formatCurrency(hourRow.overallAvg)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-3 py-2">Day Total</td>
                        {DAY_ORDER.map(day => (
                          <td key={day} className="px-3 py-2 text-center">
                            {formatCurrency(
                              viewMode === 'food' ? data.dailySummary[day]?.avgFood || 0 :
                              viewMode === 'drink' ? data.dailySummary[day]?.avgDrink || 0 :
                              data.dailySummary[day]?.avgDailyRevenue || 0
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          {formatCurrency(
                            Object.values(data.dailySummary).reduce((sum, d) => 
                              sum + (viewMode === 'food' ? d.avgFood : viewMode === 'drink' ? d.avgDrink : d.avgDailyRevenue), 0
                            ) / 7
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Items & Staffing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Cafe Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>🏆</span>
                    <span>Top Cafe Items</span>
                  </CardTitle>
                  <CardDescription>Best selling cafe products</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.topItems.slice(0, 10).map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.category === 'food' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.category === 'food' ? '🍽️' : '☕'}
                          </span>
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{formatCurrency(item.revenue)}</span>
                          <span className="text-xs text-gray-500 ml-2">({item.count} sold)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Staffing Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>👥</span>
                    <span>Cafe Staffing Guide</span>
                  </CardTitle>
                  <CardDescription>Based on {data.dateRange.weeks} weeks of cafe data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-green-700 mb-2">🟢 Peak Cafe Hours</h4>
                      <ul className="space-y-1">
                        {data.hourlyData
                          .filter(h => h.overallAvg > maxAvgRevenue * 0.5)
                          .sort((a, b) => b.overallAvg - a.overallAvg)
                          .slice(0, 4)
                          .map(h => (
                            <li key={h.hour} className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                              <span className="font-medium">{h.hourLabel}</span>
                              <span className="text-green-700">{formatCurrency(h.overallAvg)} avg</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-700 mb-2">🟠 Quiet Cafe Hours</h4>
                      <ul className="space-y-1">
                        {data.hourlyData
                          .filter(h => h.overallAvg > 0 && h.overallAvg < maxAvgRevenue * 0.2)
                          .sort((a, b) => a.overallAvg - b.overallAvg)
                          .slice(0, 4)
                          .map(h => (
                            <li key={h.hour} className="flex justify-between items-center p-2 bg-orange-50 rounded text-sm">
                              <span className="font-medium">{h.hourLabel}</span>
                              <span className="text-orange-700">{formatCurrency(h.overallAvg)} avg</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
