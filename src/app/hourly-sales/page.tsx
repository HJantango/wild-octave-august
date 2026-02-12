'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { ClockIcon, TrendingUpIcon, UsersIcon, CalendarIcon } from 'lucide-react';
import { HourlyDayChart } from '@/components/charts/hourly-day-chart';

interface HourlyData {
  hour: number;
  hourLabel: string;
  days: {
    [key: string]: {
      avgRevenue: number;
      avgOrders: number;
      avgItems: number;
      totalRevenue: number;
      totalOrders: number;
    };
  };
  overallAvg: number;
  overallOrders: number;
  overallItems: number;
  totalRevenue: number;
}

interface HourlyReport {
  dateRange: {
    from: string;
    to: string;
    weeks: number;
    category?: string;
  };
  availableCategories?: string[];
  totalOrders: number;
  hourlyData: HourlyData[];
  dailySummary: {
    [key: string]: {
      avgDailyRevenue: number;
      uniqueDays: number;
    };
  };
  insights: {
    peakHours: string[];
    quietHours: string[];
    busiestDay: string;
    quietestDay: string;
  };
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HourlySalesPage() {
  const [data, setData] = useState<HourlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState('12');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (weeksToFetch: string, categoryToFetch: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/hourly-sales?weeks=${weeksToFetch}&category=${encodeURIComponent(categoryToFetch)}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load data');
      }
    } catch (err) {
      setError('Failed to fetch hourly sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(weeks, category);
  }, [weeks, category]);

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return 'bg-gray-100';
    const intensity = value / max;
    if (intensity > 0.75) return 'bg-green-500 text-white';
    if (intensity > 0.5) return 'bg-green-400 text-white';
    if (intensity > 0.25) return 'bg-green-300';
    return 'bg-green-200';
  };

  const maxAvgRevenue = data?.hourlyData.reduce((max, h) => {
    const dayMax = Math.max(...Object.values(h.days).map(d => d.avgRevenue));
    return Math.max(max, dayMax);
  }, 0) || 100;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading hourly sales data (this may take a moment)...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">⏰ Hourly Sales Analysis</h1>
                <p className="text-indigo-100 text-lg">
                  {category === 'all' ? 'Average sales by hour' : `${category} sales by hour`} — perfect for roster planning
                </p>
                {data && (
                  <p className="text-indigo-200 text-sm mt-1">
                    {data.dateRange.from} to {data.dateRange.to} • {data.totalOrders.toLocaleString()} orders analyzed
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
                    <SelectItem value="16">16 weeks</SelectItem>
                    <SelectItem value="26">6 months</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-40 bg-white/20 border-white/20 text-white">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {data?.availableCategories?.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => fetchData(weeks, category)}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  ↻ Refresh
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
            {/* Insights Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">Peak Hours</p>
                      <p className="text-2xl font-bold">{data.insights.peakHours.join(', ')}</p>
                      <p className="text-green-100 text-xs mt-1">Busiest trading times</p>
                    </div>
                    <TrendingUpIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Quiet Hours</p>
                      <p className="text-2xl font-bold">{data.insights.quietHours.join(', ')}</p>
                      <p className="text-orange-100 text-xs mt-1">Consider reduced staffing</p>
                    </div>
                    <ClockIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Busiest Day</p>
                      <p className="text-2xl font-bold">{data.insights.busiestDay}</p>
                      <p className="text-blue-100 text-xs mt-1">
                        Avg {formatCurrency(data.dailySummary[data.insights.busiestDay]?.avgDailyRevenue || 0)}
                      </p>
                    </div>
                    <CalendarIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Quietest Day</p>
                      <p className="text-2xl font-bold">{data.insights.quietestDay}</p>
                      <p className="text-purple-100 text-xs mt-1">
                        Avg {formatCurrency(data.dailySummary[data.insights.quietestDay]?.avgDailyRevenue || 0)}
                      </p>
                    </div>
                    <UsersIcon className="w-10 h-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Day-of-Week Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📈</span>
                  <span>{category === 'all' ? 'Sales' : category} Trends by Day of Week</span>
                </CardTitle>
                <CardDescription>
                  Compare hourly patterns across different days — {data.dateRange.weeks} weeks
                  {category !== 'all' && <span className="ml-1 text-indigo-600 font-medium">• Filtered by {category}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyDayChart 
                  data={data.hourlyData} 
                  height={400}
                  title={`${category === 'all' ? 'All Sales' : category} - ${data.dateRange.weeks} Weeks`}
                  showTransactions={true}
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                  Solid lines = revenue ($) • Dotted lines = transactions (right axis)
                </p>
              </CardContent>
            </Card>

            {/* Heatmap Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📊</span>
                  <span>Average Hourly Sales by Day</span>
                </CardTitle>
                <CardDescription>
                  Darker green = higher average sales. Use this to plan staffing levels.
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
                            return (
                              <td 
                                key={day} 
                                className={`px-3 py-2 text-center ${getHeatmapColor(dayData.avgRevenue, maxAvgRevenue)}`}
                                title={`${dayData.avgOrders.toFixed(1)} orders, ${dayData.avgItems.toFixed(1)} items`}
                              >
                                {dayData.avgRevenue > 0 ? formatCurrency(dayData.avgRevenue) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold bg-gray-100">
                            {hourRow.overallAvg > 0 ? formatCurrency(hourRow.overallAvg) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-3 py-2">Day Total</td>
                        {DAY_ORDER.map(day => (
                          <td key={day} className="px-3 py-2 text-center">
                            {formatCurrency(data.dailySummary[day]?.avgDailyRevenue || 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          {formatCurrency(
                            Object.values(data.dailySummary).reduce((sum, d) => sum + d.avgDailyRevenue, 0) / 7
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Staffing Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>👥</span>
                  <span>Staffing Recommendations</span>
                </CardTitle>
                <CardDescription>
                  Based on average sales patterns over {data.dateRange.weeks} weeks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-700 mb-3">🟢 High Traffic Times</h4>
                    <ul className="space-y-2">
                      {data.hourlyData
                        .filter(h => h.overallAvg > maxAvgRevenue * 0.5)
                        .sort((a, b) => b.overallAvg - a.overallAvg)
                        .slice(0, 5)
                        .map(h => (
                          <li key={h.hour} className="flex justify-between items-center p-2 bg-green-50 rounded">
                            <span className="font-medium">{h.hourLabel}</span>
                            <span className="text-green-700">{formatCurrency(h.overallAvg)} avg</span>
                          </li>
                        ))}
                    </ul>
                    <p className="text-sm text-gray-600 mt-3">
                      Consider extra staff during these hours
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-orange-700 mb-3">🟠 Quiet Times</h4>
                    <ul className="space-y-2">
                      {data.hourlyData
                        .filter(h => h.overallAvg > 0 && h.overallAvg < maxAvgRevenue * 0.25)
                        .sort((a, b) => a.overallAvg - b.overallAvg)
                        .slice(0, 5)
                        .map(h => (
                          <li key={h.hour} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                            <span className="font-medium">{h.hourLabel}</span>
                            <span className="text-orange-700">{formatCurrency(h.overallAvg)} avg</span>
                          </li>
                        ))}
                    </ul>
                    <p className="text-sm text-gray-600 mt-3">
                      Minimum staffing or consider adjusted hours
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
