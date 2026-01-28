'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TodaysOrders } from '@/components/ordering/todays-orders';

interface OrderingSummary {
  totalActiveOrders: number;
  totalOrderValue: number;
  lowStockItems: number;
  pendingSuggestions: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    vendor: { name: string };
    status: string;
    totalIncGst: number;
    orderDate: string;
  }>;
  lowStockAlerts: Array<{
    item: { name: string; vendor?: { name: string } };
    currentStock: number;
    reorderPoint: number;
    daysOfStock: number;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    orderSettings?: {
      orderFrequency: string;
      minimumOrderValue: number;
    };
  }>;
}

async function fetchOrderingSummary(): Promise<OrderingSummary> {
  // Fetch data from multiple endpoints in parallel
  const [ordersRes, inventoryRes, vendorsRes] = await Promise.all([
    fetch('/api/purchase-orders?limit=5'),
    fetch('/api/inventory?lowStock=true&limit=5'),
    fetch('/api/vendors'),
  ]);

  if (!ordersRes.ok || !inventoryRes.ok || !vendorsRes.ok) {
    throw new Error('Failed to fetch ordering data');
  }

  const [ordersData, inventoryData, vendorsData] = await Promise.all([
    ordersRes.json(),
    inventoryRes.json(),
    vendorsRes.json(),
  ]);

  // Calculate summary stats
  const activeOrders = ordersData.purchaseOrders?.filter(
    (order: any) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED'
  ) || [];

  const totalOrderValue = activeOrders.reduce(
    (sum: number, order: any) => sum + order.totalIncGst,
    0
  );

  return {
    totalActiveOrders: activeOrders.length,
    totalOrderValue,
    lowStockItems: inventoryData.pagination?.totalCount || 0,
    pendingSuggestions: 0, // Will implement suggestions endpoint later
    recentOrders: ordersData.purchaseOrders || [],
    lowStockAlerts: inventoryData.items || [],
    vendors: vendorsData || [],
  };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-purple-100 text-purple-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export default function OrderingDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orderingSummary'],
    queryFn: fetchOrderingSummary,
    refetchInterval: 60000, // Refetch every minute
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center">
                  🛒 Ordering System
                  <span className="ml-3 flex items-center text-green-300">
                    <span className="w-2 h-2 rounded-full bg-green-300 mr-1"></span>
                    Smart Ordering
                  </span>
                </h1>
                <p className="text-green-100 text-lg">
                  Intelligent inventory management with automated order suggestions
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center space-x-3">
                <Link href="/ordering/suggestions">
                  <Button
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    🤖 Order Suggestions
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

        {/* Today's Orders */}
        <TodaysOrders />

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Active Orders</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : data?.totalActiveOrders || 0}
                  </p>
                  <p className="text-blue-100 text-xs mt-1">Purchase orders in progress</p>
                </div>
                <div className="text-3xl opacity-80">📋</div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Order Value</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : formatCurrency(data?.totalOrderValue || 0)}
                  </p>
                  <p className="text-green-100 text-xs mt-1">Total pending value</p>
                </div>
                <div className="text-3xl opacity-80">💰</div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Low Stock Items</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : data?.lowStockItems || 0}
                  </p>
                  <p className="text-orange-100 text-xs mt-1">Items need reordering</p>
                </div>
                <div className="text-3xl opacity-80">⚠️</div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Vendors</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : data?.vendors?.length || 0}
                  </p>
                  <p className="text-purple-100 text-xs mt-1">Active suppliers</p>
                </div>
                <div className="text-3xl opacity-80">🏪</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="flex items-center space-x-2">
              <span>⚡</span>
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>
              Essential ordering and inventory management tools
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <Link href="/ordering/purchase-orders/new">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg">
                  <span className="text-2xl">📝</span>
                  <span className="font-medium">New Order</span>
                  <span className="text-xs opacity-90">Create purchase order</span>
                </Button>
              </Link>

              <Link href="/ordering/calendar">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg">
                  <span className="text-2xl">📅</span>
                  <span className="font-medium">Order Calendar</span>
                  <span className="text-xs opacity-90">Scheduled vendor orders</span>
                </Button>
              </Link>

              <Link href="/ordering/cafe-schedule">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg">
                  <span className="text-2xl">☕</span>
                  <span className="font-medium">Cafe Schedule</span>
                  <span className="text-xs opacity-90">Weekly cafe orders</span>
                </Button>
              </Link>

              <Link href="/ordering/suggestions">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg">
                  <span className="text-2xl">🤖</span>
                  <span className="font-medium">AI Suggestions</span>
                  <span className="text-xs opacity-90">Smart order recommendations</span>
                </Button>
              </Link>

              <Link href="/ordering/historical">
                <Button className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
                  <span className="text-2xl">📊</span>
                  <span className="font-medium">Historical Analysis</span>
                  <span className="text-xs opacity-90">Invoice-based suggestions</span>
                </Button>
              </Link>

              <Link href="/ordering/inventory">
                <Button variant="secondary" className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 border-orange-200 shadow-lg">
                  <span className="text-2xl">📦</span>
                  <span className="font-medium text-orange-700">Inventory</span>
                  <span className="text-xs text-orange-600">Manage stock levels</span>
                </Button>
              </Link>

              <Link href="/ordering/vendors">
                <Button variant="secondary" className="w-full h-28 flex flex-col justify-center space-y-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-200 shadow-lg">
                  <span className="text-2xl">🏪</span>
                  <span className="font-medium text-purple-700">Vendors</span>
                  <span className="text-xs text-purple-600">Supplier settings</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>📋</span>
                    <span>Recent Orders</span>
                  </CardTitle>
                  <CardDescription>Latest purchase orders and their status</CardDescription>
                </div>
                <Link href="/ordering/purchase-orders">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="font-medium text-gray-900">{order.orderNumber}</p>
                            <p className="text-sm text-gray-500">{order.vendor.name}</p>
                          </div>
                          <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(order.totalIncGst)}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">📝</span>
                    <p>No orders yet</p>
                    <p className="text-sm">Create your first purchase order to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>⚠️</span>
                    <span>Stock Alerts</span>
                  </CardTitle>
                  <CardDescription>Items that need reordering soon</CardDescription>
                </div>
                <Link href="/ordering/inventory?lowStock=true">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : data?.lowStockAlerts && data.lowStockAlerts.length > 0 ? (
                  data.lowStockAlerts.map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{alert.item.name}</p>
                        <p className="text-sm text-gray-500">
                          {alert.item.vendor?.name && `${alert.item.vendor.name} • `}
                          Current: {alert.currentStock} units
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-red-100 text-red-800">
                          {alert.daysOfStock > 0 ? `${Math.ceil(alert.daysOfStock)} days left` : 'Out of stock'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">✅</span>
                    <p>All items in stock</p>
                    <p className="text-sm">No low stock alerts at this time</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Handling */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 text-red-700">
                <span className="text-xl">❌</span>
                <div>
                  <p className="font-medium">Error loading ordering data</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}