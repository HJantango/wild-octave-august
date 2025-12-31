'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker';
import { DashboardCharts, EmptyDashboardCharts } from '@/components/charts/dashboard-charts';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useDashboardData } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

const getLastWeekRange = (): DateRange => {
  const now = new Date();
  const lastWeekEnd = new Date(now);
  lastWeekEnd.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // Previous Sunday
  return { startDate: lastWeekStart, endDate: lastWeekEnd };
};

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const defaultRange = getLastWeekRange();
    return defaultRange || { startDate: new Date(), endDate: new Date() };
  });
  // Using CSV sales data exclusively
  const { data, isLoading, error, refetch, stats } = useDashboardData(dateRange);
  
  
  

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const hasData = data && data.timeSeries && data.timeSeries.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Modern Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center">
                  Health Food Shop Dashboard
                  <span className="ml-3 flex items-center text-green-300">
                    <span className="w-2 h-2 rounded-full bg-green-300 mr-1"></span>
                    CSV Sales Data
                  </span>
                </h1>
                <p className="text-blue-100 text-lg">
                  Sales analytics powered by imported CSV data and comprehensive reporting
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center space-x-3">
                <Link href="/sales">
                  <Button
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    📊 Sales Reports
                  </Button>
                </Link>
                <Button
                  onClick={refetch}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  disabled={isLoading}
                >
                  {isLoading ? '🔄' : '↻'} Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Average Stats Cards - moved to top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average Weekly Revenue */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Avg Weekly Revenue</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : stats ? formatCurrency(stats.averageWeeklyRevenue) : '$0.00'}
                  </p>
                  <p className="text-indigo-100 text-base mt-1">Last 12 weeks</p>
                </div>
                <div className="text-3xl opacity-80">📊</div>
              </div>
            </CardContent>
          </Card>

          {/* Average Monthly Revenue */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-teal-100 text-sm font-medium">Avg Monthly Revenue</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : stats ? formatCurrency(stats.averageMonthlyRevenue) : '$0.00'}
                  </p>
                  <p className="text-teal-100 text-base mt-1">Last 6 months</p>
                </div>
                <div className="text-3xl opacity-80">📅</div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Change from Last Week */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              (stats?.lastWeekChange || 0) >= 0 
                ? 'from-emerald-500 to-green-600' 
                : 'from-red-500 to-pink-600'
            }`}></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    (stats?.lastWeekChange || 0) >= 0 ? 'text-emerald-100' : 'text-red-100'
                  }`}>
                    Last Week vs Previous
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : stats ? formatCurrency(stats.lastWeekRevenue) : '$0.00'}
                  </p>
                  <div className={`text-sm mt-1 flex items-center space-x-1 ${
                    (stats?.lastWeekChange || 0) >= 0 ? 'text-emerald-100' : 'text-red-100'
                  }`}>
                    <span>{(stats?.lastWeekChange || 0) >= 0 ? '↗️' : '↘️'}</span>
                    <span className="text-lg font-semibold">
                      {Math.abs(stats?.lastWeekChange || 0).toFixed(0)}% 
                      {(stats?.lastWeekChange || 0) >= 0 ? ' increase' : ' decrease'}
                    </span>
                  </div>
                </div>
                <div className="text-3xl opacity-80">
                  {(stats?.lastWeekChange || 0) >= 0 ? '📈' : '📉'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar & Quick Actions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Range Selection */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">📅</span>
                    <p className="text-purple-100 text-sm font-medium">Date Range</p>
                  </div>
                  <CalendarDatePicker
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    className="w-full"
                  />
                  <p className="text-purple-100 text-xs mt-2">
                    {dateRange.startDate && dateRange.endDate && (
                      <>
                        {Math.abs(Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 3600 * 24))) + 1} days selected
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refresh Control */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-slate-700"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between h-full">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">🔄</span>
                    <p className="text-gray-100 text-sm font-medium">Data Control</p>
                  </div>
                  <p className="text-2xl font-bold mb-2">
                    {isLoading ? 'Loading...' : 'Ready'}
                  </p>
                  <p className="text-gray-100 text-xs">
                    Last updated: {new Date().toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <Button
                    onClick={refetch}
                    disabled={isLoading}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm px-6 py-3 text-sm font-semibold"
                  >
                    {isLoading ? '🔄' : '↻'} Refresh Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" key={`${dateRange.startDate?.getTime()}-${dateRange.endDate?.getTime()}`}>
          {/* Total Revenue Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : data?.overview ? formatCurrency(data.overview.totalRevenue) : '$0.00'}
                  </p>
                  {data?.overview.dateRange.start && (
                    <div className="text-green-100 text-xs mt-1">
                      <p>{data.overview.reportCount} report{data.overview.reportCount !== 1 ? 's' : ''}</p>
                      {data.overview.previousPeriod && (
                        <p className="flex items-center space-x-1 mt-1">
                          <span>{data.overview.previousPeriod.revenueChange >= 0 ? '↗️' : '↘️'}</span>
                          <span className={`text-lg font-semibold ${data.overview.previousPeriod.revenueChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                            {Math.abs(data.overview.previousPeriod.revenueChange).toFixed(0)}%
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-3xl opacity-80">💰</div>
              </div>
            </CardContent>
          </Card>

          {/* Items Sold Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Items Sold</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : data?.overview ? data.overview.totalQuantity.toLocaleString() : '0'}
                  </p>
                  <div className="text-blue-100 text-xs mt-1">
                    <p>{stats?.totalItems || 0} total items in catalog</p>
                    {data?.overview.previousPeriod && (
                      <p className="flex items-center space-x-1 mt-1">
                        <span>{data.overview.previousPeriod.quantityChange >= 0 ? '↗️' : '↘️'}</span>
                        <span className={`text-lg font-semibold ${data.overview.previousPeriod.quantityChange >= 0 ? 'text-blue-200' : 'text-red-200'}`}>
                          {Math.abs(data.overview.previousPeriod.quantityChange).toFixed(0)}%
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-3xl opacity-80">📦</div>
              </div>
            </CardContent>
          </Card>

          {/* Average Order Value Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Avg Order Value</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : 
                     data?.overview && data.overview.totalQuantity > 0 ? 
                     formatCurrency(data.overview.totalRevenue / data.overview.totalQuantity) : 
                     '$0.00'}
                  </p>
                  <p className="text-orange-100 text-xs mt-1">Per item sold</p>
                </div>
                <div className="text-3xl opacity-80">💳</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Enhanced */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="flex items-center space-x-2">
              <span>⚡</span>
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>
              Essential tools to manage your business efficiently
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Link href="/invoices/upload">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow-lg py-6">
                  <span className="text-2xl">📤</span>
                  <span className="font-medium">Upload Invoice</span>
                  <span className="text-xs opacity-90">Process PDF invoices</span>
                </Button>
              </Link>
              <Link href="/ordering">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg py-6">
                  <span className="text-2xl">🛒</span>
                  <span className="font-medium">Smart Ordering</span>
                  <span className="text-xs opacity-90">AI-powered orders</span>
                </Button>
              </Link>
              <Link href="/sales">
                <Button variant="secondary" className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-200 shadow-lg py-6">
                  <span className="text-2xl">📊</span>
                  <span className="font-medium text-blue-700">Analytics</span>
                  <span className="text-xs text-blue-600">View sales data</span>
                </Button>
              </Link>
              <Link href="/items">
                <Button variant="secondary" className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-200 shadow-lg py-6">
                  <span className="text-2xl">🔍</span>
                  <span className="font-medium text-purple-700">Manage Items</span>
                  <span className="text-xs text-purple-600">Inventory control</span>
                </Button>
              </Link>
              <Link href="/rectification">
                <Button variant="secondary" className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 border-orange-200 shadow-lg py-6">
                  <span className="text-2xl">⚠️</span>
                  <span className="font-medium text-orange-700">Rectification</span>
                  <span className="text-xs text-orange-600">Missing items tracker</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Charts Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Business Analytics</h2>
            {error && (
              <div className="text-red-600 text-sm bg-red-50 px-3 py-1 rounded-md">
                Error loading data: {error.message}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                      <div className="h-64 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : hasData && data ? (
            <DashboardCharts
              revenueData={data.timeSeries || []}
              categoryData={data.topCategories || []}
              topItems={data.topItems || []}
              dateRange={data.overview.dateRange}
              totalRevenue={data.overview.totalRevenue}
              totalQuantity={data.overview.totalQuantity}
            />
          ) : (
            <EmptyDashboardCharts />
          )}
        </div>

        {/* Advanced Analytics */}
        {hasData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Advanced Analytics</h2>
              <p className="text-sm text-gray-600">Detailed CSV data insights</p>
            </div>
            
            {/* Advanced Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Revenue Trend with Moving Average */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle className="flex items-center space-x-2">
                    <span>📈</span>
                    <span>Revenue Trend Analysis</span>
                  </CardTitle>
                  <CardDescription>
                    Daily revenue with 7-day moving average
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-80">
                    {data.timeSeries && data.timeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.timeSeries}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                          />
                          <YAxis 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900">{new Date(label).toLocaleDateString()}</p>
                                  <div className="space-y-1 mt-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Revenue:</span>
                                      <span className="font-medium text-blue-600">
                                        {formatCurrency(payload[0].value as number)}
                                      </span>
                                    </div>
                                    {payload[1] && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Previous Period:</span>
                                        <span className="font-medium text-gray-600">
                                          {formatCurrency(payload[1].value as number)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            fill="url(#revenueGradient)"
                          />
                          {data.timeSeries[0]?.previousPeriodRevenue && (
                            <Line
                              type="monotone"
                              dataKey="previousPeriodRevenue"
                              stroke="#9CA3AF"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">No trend data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sales Volume Analysis */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardTitle className="flex items-center space-x-2">
                    <span>📊</span>
                    <span>Sales Volume Analysis</span>
                  </CardTitle>
                  <CardDescription>
                    Daily quantity sold with trend indicators
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-80">
                    {data.timeSeries && data.timeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.timeSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900">{new Date(label).toLocaleDateString()}</p>
                                  <div className="space-y-1 mt-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Quantity:</span>
                                      <span className="font-medium text-green-600">
                                        {payload[0].value?.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="quantity" fill="#10B981" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">No volume data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardTitle className="flex items-center space-x-2">
                    <span>🎯</span>
                    <span>Performance Metrics</span>
                  </CardTitle>
                  <CardDescription>
                    Key performance indicators and trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Average Order Value Trend */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Average Daily Revenue</span>
                        <span className="text-lg font-bold text-purple-600">
                          {data.timeSeries && data.timeSeries.length > 0 ? 
                            formatCurrency(data.timeSeries.reduce((sum, day) => sum + day.revenue, 0) / data.timeSeries.length) : 
                            '$0.00'
                          }
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{
                            width: data.overview?.totalRevenue && data.timeSeries?.length ? 
                              `${Math.min(100, (data.overview.totalRevenue / data.timeSeries.length / 1000) * 10)}%` : 
                              '0%'
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Items Per Day */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Average Daily Items</span>
                        <span className="text-lg font-bold text-green-600">
                          {data.timeSeries && data.timeSeries.length > 0 ? 
                            Math.round(data.timeSeries.reduce((sum, day) => sum + day.quantity, 0) / data.timeSeries.length) : 
                            0
                          }
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{
                            width: data.overview?.totalQuantity && data.timeSeries?.length ? 
                              `${Math.min(100, (data.overview.totalQuantity / data.timeSeries.length / 50) * 100)}%` : 
                              '0%'
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Revenue Growth */}
                    {data.overview?.previousPeriod && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Period Growth</span>
                          <span className={`text-lg font-bold ${
                            data.overview.previousPeriod.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {data.overview.previousPeriod.revenueChange >= 0 ? '+' : ''}{data.overview.previousPeriod.revenueChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              data.overview.previousPeriod.revenueChange >= 0 ? 'bg-green-600' : 'bg-red-600'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.abs(data.overview.previousPeriod.revenueChange) * 2)}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Categories Donut Chart */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
                  <CardTitle className="flex items-center space-x-2">
                    <span>🎨</span>
                    <span>Category Distribution</span>
                  </CardTitle>
                  <CardDescription>
                    Revenue breakdown by product categories
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-80">
                    {data.topCategories && data.topCategories.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.topCategories.slice(0, 6)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="revenue"
                          >
                            {data.topCategories.slice(0, 6).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900">{data.category}</p>
                                  <div className="space-y-1 mt-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Revenue:</span>
                                      <span className="font-medium text-orange-600">
                                        {formatCurrency(data.revenue)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Share:</span>
                                      <span className="font-medium text-gray-900">
                                        {data.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value, entry) => (
                              <span className="text-xs">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">No category data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Real Data Sidebar */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Categories List */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center space-x-2">
                  <span>🏆</span>
                  <span>Top Categories</span>
                </CardTitle>
                <CardDescription>
                  Best performing product categories
                  {data?.overview.dateRange.start && (
                    <span className="block text-xs text-gray-400 mt-1">
                      {data.overview.dateRange.start === data.overview.dateRange.end 
                        ? new Date(data.overview.dateRange.start).toLocaleDateString()
                        : `${new Date(data.overview.dateRange.start).toLocaleDateString()} - ${new Date(data.overview.dateRange.end!).toLocaleDateString()}`
                      }
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {data.topCategories.slice(0, 5).map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{category.category}</p>
                          <p className="text-xs text-gray-500">{category.quantity} units sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(category.revenue)}
                        </p>
                        <p className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Items List */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center space-x-2">
                  <span>⭐</span>
                  <span>Top Items</span>
                </CardTitle>
                <CardDescription>
                  Best selling products
                  {data?.overview.dateRange.start && (
                    <span className="block text-xs text-gray-400 mt-1">
                      {data.overview.dateRange.start === data.overview.dateRange.end 
                        ? new Date(data.overview.dateRange.start).toLocaleDateString()
                        : `${new Date(data.overview.dateRange.start).toLocaleDateString()} - ${new Date(data.overview.dateRange.end!).toLocaleDateString()}`
                      }
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {data.topItems.slice(0, 5).map((item, index) => (
                    <div key={item.itemName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600">#{index + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.quantity} units sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(item.revenue)}
                        </p>
                        <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Help Section for CSV Data */}
        {!hasData && !isLoading && (
          <Card className="border-2 border-dashed border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Sales Data</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Upload your sales CSV files to see comprehensive analytics, revenue trends, and detailed insights about your business performance.
              </p>
              <Link href="/sales">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <span className="mr-2">📈</span>
                  Manage Sales Data
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
