'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface BestWorstItem {
  rank: number;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  recordCount: number;
  averagePerSale: number;
  performanceCategory: 'best' | 'worst' | 'middle';
}

interface BestWorstItemsData {
  items: BestWorstItem[];
  summary: {
    totalItems: number;
    totalRevenue: number;
    totalQuantity: number;
    dateRange: {
      start: number | null;
      end: number | null;
    };
    sortBy: 'revenue' | 'quantity';
    bestThreshold: number;
    worstThreshold: number;
  };
  categories: {
    best: BestWorstItem[];
    worst: BestWorstItem[];
    middle: BestWorstItem[];
  };
  stats: {
    bestPerformance: {
      avgRevenue: number;
      avgQuantity: number;
    };
    worstPerformance: {
      avgRevenue: number;
      avgQuantity: number;
    };
    revenueGap: number;
  };
}

export function BestWorstItems() {
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity'>('revenue');
  const [limit, setLimit] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams({
      sortBy,
      limit: limit.toString(),
    });
    return params.toString();
  };

  // Fetch best/worst items analysis
  const { data: analysisData, isLoading, refetch } = useQuery<BestWorstItemsData>({
    queryKey: ['best-worst-items', sortBy, limit],
    queryFn: async () => {
      const response = await fetch(`/api/sales/best-worst-items?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch best/worst items analysis');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch best/worst items analysis');
      return result.data;
    },
  });

  const handleRunAnalysis = () => {
    refetch();
  };

  // Prepare data for visualization
  const chartData = analysisData?.items.slice(0, 20).map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    value: sortBy === 'revenue' ? item.totalRevenue : item.totalQuantity,
    category: item.performanceCategory,
    fullName: item.name,
    revenue: item.totalRevenue,
    quantity: item.totalQuantity,
  })) || [];

  // Performance category colors
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'best': return '#10B981'; // Green
      case 'worst': return '#EF4444'; // Red  
      case 'middle': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  };

  // Pie chart data for category distribution
  const categoryPieData = [
    { name: 'Top Performers', value: analysisData?.categories.best.length || 0, color: '#10B981' },
    { name: 'Middle Performers', value: analysisData?.categories.middle.length || 0, color: '#6B7280' },
    { name: 'Bottom Performers', value: analysisData?.categories.worst.length || 0, color: '#EF4444' },
  ].filter(item => item.value > 0);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-green-50 to-red-50">
        <CardTitle className="flex items-center space-x-2">
          <span>🎯</span>
          <span>Best / Worst Selling Items</span>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Analyze top and bottom performing items with color-coded rankings
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <Select value={sortBy} onValueChange={(value: 'revenue' | 'quantity') => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Items to Analyze
            </label>
            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 Items</SelectItem>
                <SelectItem value="100">100 Items</SelectItem>
                <SelectItem value="150">150 Items</SelectItem>
                <SelectItem value="200">200 Items</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View Mode
            </label>
            <Select value={viewMode} onValueChange={(value: 'list' | 'chart') => setViewMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List View</SelectItem>
                <SelectItem value="chart">Chart View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Run Analysis Button */}
          <div className="flex items-end">
            <Button onClick={handleRunAnalysis} disabled={isLoading} className="w-full">
              {isLoading ? '🔄 Analyzing...' : '🚀 Run Analysis'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Analyzing item performance...</p>
            </div>
          </div>
        ) : analysisData ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Total Items</p>
                <p className="text-lg font-bold text-blue-600">
                  {analysisData.summary.totalItems}
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Top 20 Items</p>
                <p className="text-lg font-bold text-green-600">
                  {analysisData?.categories?.best?.length || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {analysisData?.stats?.bestPerformance?.avgRevenue ? formatCurrency(analysisData.stats.bestPerformance.avgRevenue) : '$0.00'} avg
                </p>
              </div>
              <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Bottom 20 Items</p>
                <p className="text-lg font-bold text-red-600">
                  {analysisData?.categories?.worst?.length || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {analysisData?.stats?.worstPerformance?.avgRevenue ? formatCurrency(analysisData.stats.worstPerformance.avgRevenue) : '$0.00'} avg
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Revenue Gap</p>
                <p className="text-lg font-bold text-purple-600">
                  {analysisData?.stats?.revenueGap ? analysisData.stats.revenueGap.toFixed(1) : '0.0'}x
                </p>
                <p className="text-xs text-gray-500">best vs worst</p>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold text-orange-600">
                  {analysisData?.summary?.totalRevenue ? formatCurrency(analysisData.summary.totalRevenue) : '$0.00'}
                </p>
              </div>
            </div>

            {viewMode === 'chart' ? (
              /* Chart Views */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Items Bar Chart */}
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">Top 20 Items Performance</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => 
                          sortBy === 'revenue' ? `$${(value / 1000).toFixed(0)}k` : value.toLocaleString()
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-medium text-gray-900">{data.fullName}</p>
                              <div className="space-y-1 mt-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Revenue:</span>
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(data.revenue)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Quantity:</span>
                                  <span className="font-medium text-blue-600">
                                    {data.quantity.toFixed(1)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Category:</span>
                                  <span className={`font-medium ${
                                    data.category === 'best' ? 'text-green-600' : 
                                    data.category === 'worst' ? 'text-red-600' : 'text-gray-600'
                                  }`}>
                                    {data.category === 'best' ? 'Top Performer' : 
                                     data.category === 'worst' ? 'Bottom Performer' : 'Middle Performer'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getCategoryColor(entry.category)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category Distribution Pie Chart */}
                <div className="h-80">
                  <h3 className="text-lg font-semibold mb-4">Performance Distribution</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Items']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="space-y-6">
                {/* Best Performers */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-green-700">
                    🏆 Top {analysisData.categories.best.length} Performers (Green)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-green-50">
                          <th className="text-left p-3">Rank</th>
                          <th className="text-left p-3">Item Name</th>
                          <th className="text-right p-3">Revenue</th>
                          <th className="text-right p-3">Quantity</th>
                          <th className="text-right p-3">Avg per Sale</th>
                          <th className="text-right p-3">Sales Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisData.categories.best.map((item) => (
                          <tr key={item.name} className="border-b border-gray-100 bg-green-25 hover:bg-green-100">
                            <td className="p-3 font-bold text-green-700">#{item.rank}</td>
                            <td className="p-3 font-medium text-green-900">{item.name}</td>
                            <td className="text-right p-3 text-green-600 font-bold">
                              {formatCurrency(item.totalRevenue)}
                            </td>
                            <td className="text-right p-3 text-green-600">
                              {item.totalQuantity.toFixed(1)}
                            </td>
                            <td className="text-right p-3 text-green-600">
                              {formatCurrency(item.averagePerSale)}
                            </td>
                            <td className="text-right p-3 text-gray-600">
                              {item.recordCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Worst Performers */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-red-700">
                    📉 Bottom {analysisData.categories.worst.length} Performers (Red)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-red-50">
                          <th className="text-left p-3">Rank</th>
                          <th className="text-left p-3">Item Name</th>
                          <th className="text-right p-3">Revenue</th>
                          <th className="text-right p-3">Quantity</th>
                          <th className="text-right p-3">Avg per Sale</th>
                          <th className="text-right p-3">Sales Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisData.categories.worst.map((item) => (
                          <tr key={item.name} className="border-b border-gray-100 bg-red-25 hover:bg-red-100">
                            <td className="p-3 font-bold text-red-700">#{item.rank}</td>
                            <td className="p-3 font-medium text-red-900">{item.name}</td>
                            <td className="text-right p-3 text-red-600 font-bold">
                              {formatCurrency(item.totalRevenue)}
                            </td>
                            <td className="text-right p-3 text-red-600">
                              {item.totalQuantity.toFixed(1)}
                            </td>
                            <td className="text-right p-3 text-red-600">
                              {formatCurrency(item.averagePerSale)}
                            </td>
                            <td className="text-right p-3 text-gray-600">
                              {item.recordCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Middle Performers (Sample) */}
                {analysisData.categories.middle.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">
                      📊 Middle Performers (Sample of {analysisData.categories.middle.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left p-3">Rank</th>
                            <th className="text-left p-3">Item Name</th>
                            <th className="text-right p-3">Revenue</th>
                            <th className="text-right p-3">Quantity</th>
                            <th className="text-right p-3">Avg per Sale</th>
                            <th className="text-right p-3">Sales Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.categories.middle.slice(0, 10).map((item) => (
                            <tr key={item.name} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-3 font-bold text-gray-700">#{item.rank}</td>
                              <td className="p-3 font-medium text-gray-900">{item.name}</td>
                              <td className="text-right p-3 text-gray-600 font-bold">
                                {formatCurrency(item.totalRevenue)}
                              </td>
                              <td className="text-right p-3 text-gray-600">
                                {item.totalQuantity.toFixed(1)}
                              </td>
                              <td className="text-right p-3 text-gray-600">
                                {formatCurrency(item.averagePerSale)}
                              </td>
                              <td className="text-right p-3 text-gray-600">
                                {item.recordCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {analysisData.categories.middle.length > 10 && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Showing 10 of {analysisData.categories.middle.length} middle performers
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🎯</div>
              <p className="text-gray-500 font-medium">Configure your analysis and click "Run Analysis"</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}