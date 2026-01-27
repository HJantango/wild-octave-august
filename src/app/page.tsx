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
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { SmartAlerts } from '@/components/dashboard/SmartAlerts';
import { SalesTrends } from '@/components/dashboard/SalesTrends';

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

// Fetch operational dashboard data
async function fetchOperationalData() {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  const result = await response.json();
  return result.data;
}

// Fetch calendar orders for current week
async function fetchWeekCalendarOrders() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const response = await fetch(`/api/calendar/orders?month=${month}`);
  if (!response.ok) throw new Error('Failed to fetch calendar orders');
  const result = await response.json();
  return result.data;
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const defaultRange = getLastWeekRange();
    return defaultRange || { startDate: new Date(), endDate: new Date() };
  });
  // Using CSV sales data exclusively
  const { data, isLoading, error, refetch, stats } = useDashboardData(dateRange);

  // Fetch operational data (diary, wastage, invoices, low stock)
  const { data: operationalData, isLoading: isLoadingOps } = useQuery({
    queryKey: ['dashboard-operational'],
    queryFn: fetchOperationalData,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch calendar orders for current week
  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ['dashboard-calendar'],
    queryFn: fetchWeekCalendarOrders,
    refetchInterval: 300000, // Refetch every 5 minutes
  });
  
  
  

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
                <h1 className="text-3xl font-bold mb-2">
                  Health Food Shop Dashboard
                </h1>
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

        {/* Operational Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Week Sales */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Week Sales</p>
                  <p className="text-2xl font-bold">
                    {isLoadingOps ? '...' : formatCurrency(operationalData?.sales.weekTotal || 0)}
                  </p>
                  <p className="text-emerald-100 text-xs mt-1">
                    {isLoadingOps ? '' : `${operationalData?.sales.weekQuantity || 0} items`}
                  </p>
                </div>
                <div className="text-3xl opacity-80">💰</div>
              </div>
            </CardContent>
          </Card>

          {/* Week Margin */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Week Margin</p>
                  <p className="text-2xl font-bold">
                    {isLoadingOps ? '...' : formatCurrency(operationalData?.sales.weekMargin || 0)}
                  </p>
                  <p className="text-blue-100 text-xs mt-1">Last 7 days</p>
                </div>
                <div className="text-3xl opacity-80">📈</div>
              </div>
            </CardContent>
          </Card>

          {/* Net Profit Estimate */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className={`absolute inset-0 bg-gradient-to-r ${
              !isLoadingOps && (operationalData?.sales.weekNetProfit || 0) >= 0
                ? 'from-teal-500 to-emerald-600'
                : 'from-red-500 to-pink-600'
            }`}></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-teal-100 text-sm font-medium">Net Profit Est.</p>
                  <p className="text-2xl font-bold">
                    {isLoadingOps ? '...' : formatCurrency(operationalData?.sales.weekNetProfit || 0)}
                  </p>
                  <p className="text-teal-100 text-xs mt-1">
                    {isLoadingOps ? '' : `Margin − $${((operationalData?.sales.weekWastage || 0) + (operationalData?.sales.weekDiscounts || 0)).toFixed(0)} losses`}
                  </p>
                </div>
                <div className="text-3xl opacity-80">💵</div>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Count */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Low Stock</p>
                  <p className="text-2xl font-bold">
                    {isLoadingOps ? '...' : operationalData?.inventory.lowStockCount || 0}
                  </p>
                  <p className="text-orange-100 text-xs mt-1">Items need reorder</p>
                </div>
                <div className="text-3xl opacity-80">⚠️</div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Overdue Tasks</p>
                  <p className="text-2xl font-bold">
                    {isLoadingOps ? '...' : operationalData?.diary.overdueCount || 0}
                  </p>
                  <p className="text-purple-100 text-xs mt-1">Diary entries</p>
                </div>
                <div className="text-3xl opacity-80">📋</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shop Diary & Alerts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shop Diary */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <span>📔</span>
                  <span>Shop Diary</span>
                </CardTitle>
                <Link href="/shop-diary">
                  <Button size="sm" variant="outline">View All</Button>
                </Link>
              </div>
              <CardDescription>Upcoming and overdue tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingOps ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {/* Overdue Tasks */}
                  {operationalData?.diary.overdue && operationalData.diary.overdue.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2">Overdue</h4>
                      <div className="space-y-2">
                        {operationalData.diary.overdue.slice(0, 3).map((entry: any) => (
                          <div key={entry.id} className="flex items-start justify-between p-2 bg-red-50 rounded border-l-4 border-red-500">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                              <p className="text-xs text-gray-600">{new Date(entry.dueDate).toLocaleDateString()}</p>
                            </div>
                            <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Tasks */}
                  {operationalData?.diary.upcoming && operationalData.diary.upcoming.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-blue-600 mb-2">Upcoming (Next 7 Days)</h4>
                      <div className="space-y-2">
                        {operationalData.diary.upcoming.slice(0, 3).map((entry: any) => (
                          <div key={entry.id} className="flex items-start justify-between p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                              <p className="text-xs text-gray-600">{new Date(entry.dueDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!operationalData?.diary.overdue || operationalData.diary.overdue.length === 0) &&
                   (!operationalData?.diary.upcoming || operationalData.diary.upcoming.length === 0) && (
                    <p className="text-gray-500 text-sm text-center py-4">No diary entries</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Calendar Week View */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <span>📅</span>
                  <span>Upcoming Orders This Week</span>
                </CardTitle>
                <Link href="/ordering/calendar">
                  <Button size="sm" variant="outline">Full Calendar</Button>
                </Link>
              </div>
              <CardDescription>Scheduled deliveries for the next 7 days</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingCalendar ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // Get orders for the next 7 days
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const nextWeek = new Date(today);
                    nextWeek.setDate(today.getDate() + 7);

                    const upcomingOrders = calendarData?.orders
                      ?.filter((order: any) => {
                        const deliveryDate = new Date(order.deliveryDate);
                        return deliveryDate >= today && deliveryDate < nextWeek;
                      })
                      .sort((a: any, b: any) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
                      .slice(0, 7) || [];

                    if (upcomingOrders.length === 0) {
                      return <p className="text-gray-500 text-sm text-center py-4">No orders scheduled for this week</p>;
                    }

                    return upcomingOrders.map((order: any) => {
                      const deliveryDate = new Date(order.deliveryDate);
                      const dayName = deliveryDate.toLocaleDateString('en-AU', { weekday: 'short' });
                      const dateStr = deliveryDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                      const isToday = deliveryDate.toDateString() === today.toDateString();

                      return (
                        <div key={order.id} className={`flex items-center justify-between p-3 rounded border-l-4 ${
                          isToday ? 'bg-green-50 border-green-500' :
                          order.status === 'due' ? 'bg-yellow-50 border-yellow-500' :
                          order.status === 'placed' ? 'bg-blue-50 border-blue-500' :
                          'bg-purple-50 border-purple-500'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900">{order.vendorName}</p>
                              <Badge className={
                                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                order.status === 'placed' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'due' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-purple-100 text-purple-800'
                              }>
                                {order.status}
                              </Badge>
                            </div>
                            {order.orderDeadline && (
                              <p className="text-xs text-gray-600">Order by: {order.orderDeadline}</p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-sm font-bold text-gray-900">{dayName}</p>
                            <p className="text-xs text-gray-600">{dateStr}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Smart Alerts & Sales Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SmartAlerts />
          <SalesTrends />
        </div>

        {/* Invoices & Wastage/Discounts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <Card className="border-0 shadow-lg lg:col-span-2">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <span>📄</span>
                  <span>Recent Invoices</span>
                  {operationalData?.invoices.rectificationPending > 0 && (
                    <Badge className="bg-red-500 text-white ml-2">
                      {operationalData.invoices.rectificationPending} Need Rectification
                    </Badge>
                  )}
                </CardTitle>
                <Link href="/invoices">
                  <Button size="sm" variant="outline">View All</Button>
                </Link>
              </div>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingOps ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {operationalData?.invoices.recent && operationalData.invoices.recent.length > 0 ? (
                    operationalData.invoices.recent.map((invoice: any) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">{invoice.vendorName}</p>
                            <Badge className={
                              invoice.status === 'PROCESSED' ? 'bg-green-100 text-green-800' :
                              invoice.status === 'RECEIVED' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {invoice.status}
                            </Badge>
                            {invoice.needsRectification && (
                              <Badge className="bg-red-100 text-red-800">Rectify</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">#{invoice.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.totalIncGst)}</p>
                          <p className="text-xs text-gray-500">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">No recent invoices</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wastage & Discounts Summary */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardTitle className="flex items-center space-x-2">
                <span>📊</span>
                <span>Loss Summary</span>
              </CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingOps ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {/* Wastage */}
                  <div className="p-3 bg-red-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-red-900">Wastage</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(operationalData?.wastage.totals.cost || 0)}
                      </p>
                    </div>
                    <p className="text-xs text-red-700">
                      {operationalData?.wastage.totals.quantity || 0} items wasted
                    </p>
                  </div>

                  {/* Discounts */}
                  <div className="p-3 bg-orange-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-orange-900">Discounts</p>
                      <p className="text-lg font-bold text-orange-600">
                        {formatCurrency(operationalData?.discounts.totals.amount || 0)}
                      </p>
                    </div>
                    <p className="text-xs text-orange-700">
                      {operationalData?.discounts.totals.quantity || 0} items discounted
                    </p>
                  </div>

                  {/* Total Loss */}
                  <div className="p-3 bg-gray-100 rounded border-t-2 border-gray-300">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Total Loss</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(
                          (operationalData?.wastage.totals.cost || 0) +
                          (operationalData?.discounts.totals.amount || 0)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
                    {isLoading ? '...' : stats ? formatCurrency(Number(stats.averageWeeklyRevenue) || 0) : '$0.00'}
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
                    {isLoading ? '...' : stats ? formatCurrency(Number(stats.averageMonthlyRevenue) || 0) : '$0.00'}
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
              (Number(stats?.lastWeekChange) || 0) >= 0
                ? 'from-emerald-500 to-green-600'
                : 'from-red-500 to-pink-600'
            }`}></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    (Number(stats?.lastWeekChange) || 0) >= 0 ? 'text-emerald-100' : 'text-red-100'
                  }`}>
                    Last Week vs Previous
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : stats ? formatCurrency(Number(stats.lastWeekRevenue) || 0) : '$0.00'}
                  </p>
                  <div className={`text-sm mt-1 flex items-center space-x-1 ${
                    (Number(stats?.lastWeekChange) || 0) >= 0 ? 'text-emerald-100' : 'text-red-100'
                  }`}>
                    <span>{(Number(stats?.lastWeekChange) || 0) >= 0 ? '↗️' : '↘️'}</span>
                    <span className="text-lg font-semibold">
                      {Math.abs(Number(stats?.lastWeekChange) || 0).toFixed(0)}%
                      {(Number(stats?.lastWeekChange) || 0) >= 0 ? ' increase' : ' decrease'}
                    </span>
                  </div>
                </div>
                <div className="text-3xl opacity-80">
                  {(Number(stats?.lastWeekChange) || 0) >= 0 ? '📈' : '📉'}
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
                          <span>{(Number(data.overview.previousPeriod.revenueChange) || 0) >= 0 ? '↗️' : '↘️'}</span>
                          <span className={`text-lg font-semibold ${(Number(data.overview.previousPeriod.revenueChange) || 0) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                            {Math.abs(Number(data.overview.previousPeriod.revenueChange) || 0).toFixed(0)}%
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
                        <span>{(Number(data.overview.previousPeriod.quantityChange) || 0) >= 0 ? '↗️' : '↘️'}</span>
                        <span className={`text-lg font-semibold ${(Number(data.overview.previousPeriod.quantityChange) || 0) >= 0 ? 'text-blue-200' : 'text-red-200'}`}>
                          {Math.abs(Number(data.overview.previousPeriod.quantityChange) || 0).toFixed(0)}%
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
                     data?.overview && (Number(data.overview.totalQuantity) || 0) > 0 ?
                     formatCurrency((Number(data.overview.totalRevenue) || 0) / (Number(data.overview.totalQuantity) || 1)) :
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
                            formatCurrency(data.timeSeries.reduce((sum, day) => sum + (Number(day.revenue) || 0), 0) / data.timeSeries.length) :
                            '$0.00'
                          }
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: data.overview?.totalRevenue && data.timeSeries?.length && data.timeSeries.length > 0 ?
                              `${Math.min(100, Math.max(0, (Number(data.overview.totalRevenue) || 0) / data.timeSeries.length / 1000 * 10))}%` :
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
                            Math.round(data.timeSeries.reduce((sum, day) => sum + (Number(day.quantity) || 0), 0) / data.timeSeries.length) :
                            0
                          }
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: data.overview?.totalQuantity && data.timeSeries?.length && data.timeSeries.length > 0 ?
                              `${Math.min(100, Math.max(0, ((Number(data.overview.totalQuantity) || 0) / data.timeSeries.length / 50) * 100))}%` :
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
                            (Number(data.overview.previousPeriod.revenueChange) || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {(Number(data.overview.previousPeriod.revenueChange) || 0) >= 0 ? '+' : ''}{(Number(data.overview.previousPeriod.revenueChange) || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              (Number(data.overview.previousPeriod.revenueChange) || 0) >= 0 ? 'bg-green-600' : 'bg-red-600'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, Math.abs(Number(data.overview.previousPeriod.revenueChange) || 0) * 2))}%`
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
