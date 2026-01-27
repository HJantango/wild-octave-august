'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface MarginItem {
  id: string;
  name: string;
  category: string;
  vendorName: string;
  cost: number;
  sell: number;
  markup: number;
  grossProfit: number;
  marginPercent: number;
}

interface CategoryMargin {
  category: string;
  itemCount: number;
  avgMarginPercent: number;
  avgMarkup: number;
  totalCost: number;
  totalSell: number;
}

interface VendorMargin {
  vendorId: string;
  vendorName: string;
  itemCount: number;
  avgMarginPercent: number;
  avgMarkup: number;
}

interface MarginData {
  summary: {
    totalItems: number;
    itemsWithPricing: number;
    overallAvgMargin: number;
    overallAvgMarkup: number;
  };
  categoryMargins: CategoryMargin[];
  vendorMargins: VendorMargin[];
  lowestMarginItems: MarginItem[];
  highestMarginItems: MarginItem[];
}

const MARGIN_COLORS = {
  danger: '#EF4444',   // < 20%
  warning: '#F59E0B',  // 20-30%
  ok: '#3B82F6',       // 30-40%
  good: '#10B981',     // 40-50%
  great: '#059669',    // > 50%
};

function getMarginColor(margin: number): string {
  if (margin < 20) return MARGIN_COLORS.danger;
  if (margin < 30) return MARGIN_COLORS.warning;
  if (margin < 40) return MARGIN_COLORS.ok;
  if (margin < 50) return MARGIN_COLORS.good;
  return MARGIN_COLORS.great;
}

function getMarginBadge(margin: number) {
  if (margin < 20) return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  if (margin < 30) return <Badge className="bg-yellow-100 text-yellow-800">Below Avg</Badge>;
  if (margin < 40) return <Badge className="bg-blue-100 text-blue-800">Average</Badge>;
  if (margin < 50) return <Badge className="bg-green-100 text-green-800">Good</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800">Excellent</Badge>;
}

export default function MarginsReportPage() {
  const [data, setData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'category' | 'vendor' | 'lowest' | 'highest'>('category');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/reports/margins');
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

  const filteredLowest = useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data.lowestMarginItems;
    const term = searchTerm.toLowerCase();
    return data.lowestMarginItems.filter(
      (i) => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term) || i.vendorName.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const filteredHighest = useMemo(() => {
    if (!data) return [];
    if (!searchTerm) return data.highestMarginItems;
    const term = searchTerm.toLowerCase();
    return data.highestMarginItems.filter(
      (i) => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term) || i.vendorName.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-lg">Loading margin analysis...</div>
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold mb-2">💹 Profit Margin Analysis</h1>
            <p className="text-amber-100">
              Identify pricing opportunities — which items need price increases and which are performing well
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Items Analyzed</p>
              <p className="text-3xl font-bold text-gray-900">{data.summary.itemsWithPricing}</p>
              <p className="text-xs text-gray-400 mt-1">of {data.summary.totalItems} total items</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Avg Gross Margin</p>
              <p className="text-3xl font-bold" style={{ color: getMarginColor(data.summary.overallAvgMargin) }}>
                {data.summary.overallAvgMargin}%
              </p>
              <p className="text-xs text-gray-400 mt-1">across all items</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Avg Markup</p>
              <p className="text-3xl font-bold text-blue-600">{data.summary.overallAvgMarkup}%</p>
              <p className="text-xs text-gray-400 mt-1">cost to sell price</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 font-medium">Categories</p>
              <p className="text-3xl font-bold text-purple-600">{data.categoryMargins.length}</p>
              <p className="text-xs text-gray-400 mt-1">product categories</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b pb-2">
          {[
            { key: 'category' as const, label: '📂 By Category' },
            { key: 'vendor' as const, label: '🏭 By Vendor' },
            { key: 'lowest' as const, label: '⚠️ Lowest Margins' },
            { key: 'highest' as const, label: '🌟 Highest Margins' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white border border-b-0 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category View */}
        {activeTab === 'category' && (
          <div className="space-y-6">
            {/* Category Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Gross Margin % by Category</CardTitle>
                <CardDescription>Lower margin categories may need pricing review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryMargins} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={120} />
                      <Tooltip
                        formatter={(value: any) => [`${value}%`, 'Avg Margin']}
                        labelFormatter={(label: any) => `Category: ${label}`}
                      />
                      <Bar dataKey="avgMarginPercent" radius={[0, 4, 4, 0]}>
                        {data.categoryMargins.map((entry, idx) => (
                          <Cell key={idx} fill={getMarginColor(entry.avgMarginPercent)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Category Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-right p-3 font-medium">Items</th>
                        <th className="text-right p-3 font-medium">Avg Margin %</th>
                        <th className="text-right p-3 font-medium">Avg Markup %</th>
                        <th className="text-center p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryMargins.map((cat) => (
                        <tr key={cat.category} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{cat.category}</td>
                          <td className="p-3 text-right text-gray-600">{cat.itemCount}</td>
                          <td className="p-3 text-right font-semibold" style={{ color: getMarginColor(cat.avgMarginPercent) }}>
                            {cat.avgMarginPercent}%
                          </td>
                          <td className="p-3 text-right text-gray-600">{cat.avgMarkup}%</td>
                          <td className="p-3 text-center">{getMarginBadge(cat.avgMarginPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Vendor View */}
        {activeTab === 'vendor' && (
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Average Margin by Vendor</CardTitle>
                <CardDescription>Compare margins across your suppliers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.vendorMargins} layout="vertical" margin={{ left: 140 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="vendorName" tick={{ fontSize: 12 }} width={140} />
                      <Tooltip
                        formatter={(value: any) => [`${value}%`, 'Avg Margin']}
                        labelFormatter={(label: any) => `Vendor: ${label}`}
                      />
                      <Bar dataKey="avgMarginPercent" radius={[0, 4, 4, 0]}>
                        {data.vendorMargins.map((entry, idx) => (
                          <Cell key={idx} fill={getMarginColor(entry.avgMarginPercent)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Vendor Margin Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium">Vendor</th>
                        <th className="text-right p-3 font-medium">Items</th>
                        <th className="text-right p-3 font-medium">Avg Margin %</th>
                        <th className="text-right p-3 font-medium">Avg Markup %</th>
                        <th className="text-center p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vendorMargins.map((v) => (
                        <tr key={v.vendorId} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{v.vendorName}</td>
                          <td className="p-3 text-right text-gray-600">{v.itemCount}</td>
                          <td className="p-3 text-right font-semibold" style={{ color: getMarginColor(v.avgMarginPercent) }}>
                            {v.avgMarginPercent}%
                          </td>
                          <td className="p-3 text-right text-gray-600">{v.avgMarkup}%</td>
                          <td className="p-3 text-center">{getMarginBadge(v.avgMarginPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lowest Margins */}
        {activeTab === 'lowest' && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-red-600">⚠️ Lowest Margin Items</CardTitle>
                  <CardDescription>These items are candidates for price increases</CardDescription>
                </div>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-red-50">
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Vendor</th>
                      <th className="text-right p-3 font-medium">Cost</th>
                      <th className="text-right p-3 font-medium">Sell</th>
                      <th className="text-right p-3 font-medium">Profit</th>
                      <th className="text-right p-3 font-medium">Margin %</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLowest.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-red-50/50">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3 text-gray-600">{item.category}</td>
                        <td className="p-3 text-gray-600">{item.vendorName}</td>
                        <td className="p-3 text-right">{formatCurrency(item.cost)}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sell)}</td>
                        <td className="p-3 text-right font-medium" style={{ color: getMarginColor(item.marginPercent) }}>
                          {formatCurrency(item.grossProfit)}
                        </td>
                        <td className="p-3 text-right font-bold" style={{ color: getMarginColor(item.marginPercent) }}>
                          {item.marginPercent.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">{getMarginBadge(item.marginPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Highest Margins */}
        {activeTab === 'highest' && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-green-600">🌟 Highest Margin Items</CardTitle>
                  <CardDescription>These items are performing well on margins</CardDescription>
                </div>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-green-50">
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Vendor</th>
                      <th className="text-right p-3 font-medium">Cost</th>
                      <th className="text-right p-3 font-medium">Sell</th>
                      <th className="text-right p-3 font-medium">Profit</th>
                      <th className="text-right p-3 font-medium">Margin %</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHighest.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-green-50/50">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3 text-gray-600">{item.category}</td>
                        <td className="p-3 text-gray-600">{item.vendorName}</td>
                        <td className="p-3 text-right">{formatCurrency(item.cost)}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sell)}</td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {formatCurrency(item.grossProfit)}
                        </td>
                        <td className="p-3 text-right font-bold text-green-600">
                          {item.marginPercent.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">{getMarginBadge(item.marginPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
