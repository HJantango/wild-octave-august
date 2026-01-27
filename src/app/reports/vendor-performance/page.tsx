'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface VendorData {
  id: string;
  name: string;
  itemCount: number;
  totalInvoices: number;
  totalInvoiceValue: number;
  avgInvoiceValue: number;
  ordersPerMonth: number;
  spendTrend: number;
  recentInvoiceCount: number;
  avgMargin: number;
  priceChangeCount: number;
  totalPurchaseOrders: number;
  poValue: number;
  schedules: { orderDay: string; deliveryDay: string | null; frequency: string }[];
  lastInvoiceDate: string | null;
}

interface PerformanceData {
  summary: {
    totalVendors: number;
    activeVendors: number;
    totalSpend6Months: number;
    avgSpendPerVendor: number;
  };
  vendors: VendorData[];
}

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

export default function VendorPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'spend' | 'frequency' | 'margin' | 'items'>('spend');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/reports/vendor-performance');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-lg">Loading vendor performance data...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error || 'No data available'}</div>
        </div>
      </DashboardLayout>
    );
  }

  const sortedVendors = [...data.vendors].sort((a, b) => {
    switch (sortBy) {
      case 'spend': return b.totalInvoiceValue - a.totalInvoiceValue;
      case 'frequency': return b.ordersPerMonth - a.ordersPerMonth;
      case 'margin': return b.avgMargin - a.avgMargin;
      case 'items': return b.itemCount - a.itemCount;
      default: return 0;
    }
  });

  // Top 10 vendors by spend for chart
  const topBySpend = sortedVendors
    .filter((v) => v.totalInvoiceValue > 0)
    .slice(0, 10)
    .map((v) => ({ name: v.name.length > 18 ? v.name.slice(0, 18) + '…' : v.name, spend: v.totalInvoiceValue }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold mb-2">🏭 Vendor Performance Summary</h1>
            <p className="text-blue-100">
              Track supplier activity, spend patterns, and order frequency over the last 6 months
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Total Vendors</p>
              <p className="text-3xl font-bold text-gray-900">{data.summary.totalVendors}</p>
              <p className="text-xs text-gray-400 mt-1">{data.summary.activeVendors} active (6mo)</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Total Spend (6mo)</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(data.summary.totalSpend6Months)}</p>
              <p className="text-xs text-gray-400 mt-1">across all invoices</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Avg per Vendor</p>
              <p className="text-3xl font-bold text-purple-600">{formatCurrency(data.summary.avgSpendPerVendor)}</p>
              <p className="text-xs text-gray-400 mt-1">active vendors only</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Price Changes</p>
              <p className="text-3xl font-bold text-orange-600">
                {data.vendors.reduce((s, v) => s + v.priceChangeCount, 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">in last 6 months</p>
            </CardContent>
          </Card>
        </div>

        {/* Spend Chart */}
        {topBySpend.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Top Vendors by Spend (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBySpend} layout="vertical" margin={{ left: 140 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Total Spend']} />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                      {topBySpend.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 font-medium">Sort by:</span>
          {[
            { key: 'spend' as const, label: 'Total Spend' },
            { key: 'frequency' as const, label: 'Order Frequency' },
            { key: 'margin' as const, label: 'Avg Margin' },
            { key: 'items' as const, label: 'Item Count' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Vendor Cards */}
        <div className="space-y-3">
          {sortedVendors.map((vendor) => {
            const isExpanded = expandedVendor === vendor.id;
            return (
              <Card key={vendor.id} className="border-0 shadow-lg overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedVendor(isExpanded ? null : vendor.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{vendor.name}</h3>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-gray-500">{vendor.itemCount} items</span>
                          {vendor.schedules.length > 0 && (
                            <span className="text-xs text-blue-600">
                              📅 {vendor.schedules.map((s) => s.orderDay).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Spend</p>
                        <p className="font-bold text-gray-900">{formatCurrency(vendor.totalInvoiceValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Avg Invoice</p>
                        <p className="font-bold text-gray-900">{formatCurrency(vendor.avgInvoiceValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Orders/mo</p>
                        <p className="font-bold text-blue-600">{vendor.ordersPerMonth}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Avg Margin</p>
                        <p className={`font-bold ${vendor.avgMargin >= 30 ? 'text-green-600' : vendor.avgMargin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {vendor.avgMargin}%
                        </p>
                      </div>
                      {vendor.spendTrend !== 0 && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Trend</p>
                          <Badge className={vendor.spendTrend > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                            {vendor.spendTrend > 0 ? '↑' : '↓'} {Math.abs(vendor.spendTrend)}%
                          </Badge>
                        </div>
                      )}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 Invoice History</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-gray-500">Total invoices:</span> <span className="font-medium">{vendor.totalInvoices}</span></p>
                          <p><span className="text-gray-500">Recent (3mo):</span> <span className="font-medium">{vendor.recentInvoiceCount}</span></p>
                          <p><span className="text-gray-500">Last invoice:</span> <span className="font-medium">
                            {vendor.lastInvoiceDate ? new Date(vendor.lastInvoiceDate).toLocaleDateString('en-AU') : 'N/A'}
                          </span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">🛒 Order Activity</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-gray-500">Purchase orders:</span> <span className="font-medium">{vendor.totalPurchaseOrders}</span></p>
                          <p><span className="text-gray-500">PO value:</span> <span className="font-medium">{formatCurrency(vendor.poValue)}</span></p>
                          <p><span className="text-gray-500">Price changes:</span> <span className="font-medium">{vendor.priceChangeCount}</span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">📅 Schedules</h4>
                        {vendor.schedules.length > 0 ? (
                          <div className="space-y-1 text-sm">
                            {vendor.schedules.map((s, idx) => (
                              <p key={idx}>
                                <span className="font-medium">{s.orderDay}</span>
                                {s.deliveryDay && <span className="text-gray-500"> → delivers {s.deliveryDay}</span>}
                                <span className="text-gray-400 text-xs ml-1">({s.frequency})</span>
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No schedules configured</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
