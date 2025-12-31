'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSquareSalesSummary, useSquareSync, useSquareOrders, useSquareCatalog } from '@/hooks/useSquare';
import { useSquareAuthStatus, useSquareReAuth } from '@/hooks/useSquareAuth';
import { formatCurrency } from '@/lib/format';
import { RefreshCwIcon, RotateCcwIcon, StoreIcon, CreditCardIcon, ShoppingCartIcon, PackageIcon, TrendingUpIcon, ClockIcon, XIcon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';

interface SquareDashboardProps {
  className?: string;
}

export function SquareDashboard({ className = '' }: SquareDashboardProps) {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [locationId, setLocationId] = useState<string>('');
  
  // Calculate date filters
  const getDateFilters = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        return { startDate: today, endDate: now };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return { startDate: weekStart, endDate: now };
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(today.getDate() - 30);
        return { startDate: monthStart, endDate: now };
      default:
        return {};
    }
  };

  const filters = {
    ...getDateFilters(),
    ...(locationId && { locationId })
  };

  // Square authentication and data hooks
  const authStatus = useSquareAuthStatus();
  const reAuthMutation = useSquareReAuth();
  const salesSummary = useSquareSalesSummary(filters);
  const recentOrders = useSquareOrders({
    ...filters,
    startDate: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
  });
  const catalog = useSquareCatalog();
  const syncMutation = useSquareSync();

  const handleSync = () => {
    syncMutation.mutate({
      syncType: 'full',
      ...filters
    });
  };

  const handleQuickSync = (type: 'catalog' | 'orders' | 'payments') => {
    syncMutation.mutate({
      syncType: type,
      ...filters
    });
  };

  const handleReAuth = () => {
    reAuthMutation.mutate();
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      salesSummary.refetch();
      recentOrders.refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [salesSummary.refetch, recentOrders.refetch]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Authentication Status Banner */}
      {authStatus.data && !authStatus.data.isAuthenticated && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-amber-800 font-medium">Square Authentication Required</p>
                  <p className="text-amber-700 text-sm">{authStatus.data.message}</p>
                </div>
              </div>
              <Button
                onClick={handleReAuth}
                disabled={reAuthMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {reAuthMutation.isPending ? (
                  <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                )}
                Authenticate Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <StoreIcon className="w-8 h-8 mr-3" />
                Square Integration
                {authStatus.data?.isAuthenticated && (
                  <CheckCircleIcon className="w-6 h-6 ml-2 text-green-300" />
                )}
              </h1>
              <p className="text-blue-100 text-lg">
                Real-time sales data and analytics from Square Point of Sale
              </p>
              <p className="text-blue-200 text-sm mt-1">
                {authStatus.data?.isAuthenticated 
                  ? `Connected • ${salesSummary.data?.lastSync ? `Last synced: ${new Date(salesSummary.data.lastSync).toLocaleString()}` : 'Ready to sync'}`
                  : 'Using demo data - authenticate to view live data'
                }
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col items-end space-y-3">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleSync}
                  disabled={syncMutation.isPending || !authStatus.data?.isAuthenticated}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm px-6 py-3 text-lg font-semibold disabled:opacity-50"
                >
                  {syncMutation.isPending ? (
                    <RefreshCwIcon className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <RotateCcwIcon className="w-5 h-5 mr-2" />
                  )}
                  Sync All Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSync('catalog')}
            disabled={syncMutation.isPending || !authStatus.data?.isAuthenticated}
          >
            <PackageIcon className="w-4 h-4 mr-1" />
            Sync Catalog
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSync('orders')}
            disabled={syncMutation.isPending || !authStatus.data?.isAuthenticated}
          >
            <ShoppingCartIcon className="w-4 h-4 mr-1" />
            Sync Orders
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {salesSummary.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(salesSummary.data.overview.totalRevenue)}
                  </p>
                  <p className="text-sm opacity-75 mt-1">
                    {salesSummary.data.overview.totalOrders} orders
                  </p>
                </div>
                <TrendingUpIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Items Sold</p>
                  <p className="text-3xl font-bold">
                    {salesSummary.data.overview.totalQuantity.toLocaleString()}
                  </p>
                  <p className="text-sm opacity-75 mt-1">
                    {salesSummary.data.realtimeMetrics.itemsPerOrder.toFixed(1)} per order
                  </p>
                </div>
                <PackageIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Avg Order Value</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(salesSummary.data.realtimeMetrics.averageOrderValue)}
                  </p>
                  <p className="text-sm opacity-75 mt-1">
                    {salesSummary.data.realtimeMetrics.paymentSuccessRate.toFixed(1)}% success rate
                  </p>
                </div>
                <CreditCardIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Payments</p>
                  <p className="text-3xl font-bold">
                    {salesSummary.data.overview.totalPayments}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Processed</p>
                </div>
                <CreditCardIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Items and Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Items */}
        {salesSummary.data && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUpIcon className="w-5 h-5 mr-2" />
                Top Selling Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesSummary.isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCwIcon className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {salesSummary.data.topItems.slice(0, 5).map((item, index) => (
                    <div key={item.itemName} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.quantity} sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.revenue)}</p>
                        <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClockIcon className="w-5 h-5 mr-2" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCwIcon className="w-6 h-6 animate-spin" />
              </div>
            ) : recentOrders.data?.orders?.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.data.orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{order.source}</Badge>
                      <p className="font-medium">{formatCurrency(order.totalAmount)}</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{order.itemsCount} items • {new Date(order.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent orders found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {syncMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-blue-800">Syncing Square data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {syncMutation.isSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RotateCcwIcon className="w-5 h-5 text-green-600" />
              <p className="text-green-800">Square data synced successfully!</p>
            </div>
          </CardContent>
        </Card>
      )}

      {syncMutation.isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RotateCcwIcon className="w-5 h-5 text-red-600" />
              <p className="text-red-800">Sync failed: {syncMutation.error?.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}