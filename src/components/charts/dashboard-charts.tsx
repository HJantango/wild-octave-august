'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { formatCurrency, formatDate } from '@/lib/format';

interface DashboardChartsProps {
  revenueData: Array<{
    date: string;
    revenue: number;
    quantity: number;
    previousPeriodRevenue?: number;
    previousPeriodQuantity?: number;
  }>;
  categoryData: Array<{
    category: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemName: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  dateRange?: {
    start: string | null;
    end: string | null;
  };
  totalRevenue?: number;
  totalQuantity?: number;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

export function DashboardCharts({ revenueData, categoryData, topItems, dateRange, totalRevenue, totalQuantity }: DashboardChartsProps) {
  
  const formatDateRange = () => {
    if (!dateRange?.start && !dateRange?.end) return 'All Time';
    if (dateRange.start && dateRange.end) {
      const start = formatDate(new Date(dateRange.start));
      const end = formatDate(new Date(dateRange.end));
      return start === end ? start : `${start} - ${end}`;
    }
    return 'Selected Period';
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trends</h3>
            <p className="text-xs text-gray-500">{formatDateRange()}</p>
            <p className="text-sm font-medium text-green-600">
              Total: {formatCurrency(totalRevenue || 0)}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Current Period</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-sm text-gray-600">Previous Period</span>
            </div>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatDate(new Date(value))}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900">{formatDate(new Date(label))}</p>
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Revenue:</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(payload[0].value as number)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Items sold:</span>
                          <span className="font-medium text-gray-900">
                            {payload[1]?.value?.toLocaleString() || 0}
                          </span>
                        </div>
                        {payload[2] && payload[2].value && (
                          <div className="flex justify-between items-center border-t pt-1 mt-1">
                            <span className="text-sm text-gray-600">Previous period:</span>
                            <span className="font-medium text-gray-600">
                              {formatCurrency(payload[2].value as number)}
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
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
              <Area
                type="monotone"
                dataKey="previousPeriodRevenue"
                stroke="#9CA3AF"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Distribution Horizontal Bar Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Category Performance</h3>
            <p className="text-xs text-gray-500">{formatDateRange()}</p>
            <p className="text-sm font-medium text-blue-600">
              Total: {formatCurrency(
                Array.isArray(categoryData) && categoryData.length > 0 
                  ? categoryData.reduce((sum, item) => sum + (typeof item?.revenue === 'number' ? item.revenue : 0), 0)
                  : totalRevenue || 0
              )}
            </p>
          </div>
          <div className="text-sm text-gray-600">By Revenue</div>
        </div>
        <div className="h-96">
          {categoryData && categoryData.length > 0 ? (
            <>
              {/* Vertical Bar Chart - More Reliable */}
              <ResponsiveContainer width="100%" height={280}>
                <BarChart 
                  data={categoryData.filter(item => item && item.revenue > 0).slice(0, 8)} 
                  margin={{ bottom: 40, left: 20, right: 20, top: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{label}</p>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Revenue:</span>
                              <span className="font-medium text-blue-600">
                                {formatCurrency(data.revenue)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Quantity:</span>
                              <span className="font-medium text-green-600">
                                {data.quantity.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">% of Total:</span>
                              <span className="font-medium text-purple-600">
                                {data.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    radius={[4, 4, 0, 0]}
                  >
                    {categoryData.filter(item => item && item.revenue > 0).slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-gray-500 font-medium">No category data available</p>
                <p className="text-gray-400 text-sm mt-1">
                  {!categoryData ? 'Loading...' : 'Select a different date range'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Items Bar Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Items</h3>
            <p className="text-xs text-gray-500">{formatDateRange()}</p>
            <p className="text-sm font-medium text-purple-600">
              Total (Top 8): {formatCurrency(
                Array.isArray(topItems) && topItems.length > 0 
                  ? topItems.slice(0, 8).reduce((sum, item) => sum + (typeof item?.revenue === 'number' ? item.revenue : 0), 0)
                  : totalRevenue || 0
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Quantity</span>
            </div>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems.slice(0, 8)} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="itemName" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                yAxisId="revenue"
                orientation="left"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <YAxis 
                yAxisId="quantity"
                orientation="right"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{label}</p>
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Revenue:</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(data.revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Quantity:</span>
                          <span className="font-medium text-green-600">
                            {data.quantity.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">% of Total:</span>
                          <span className="font-medium text-gray-900">
                            {data.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#3B82F6"
                name="Revenue"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="quantity"
                dataKey="quantity"
                fill="#10B981"
                name="Quantity"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function EmptyDashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Empty Revenue Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-500 font-medium">Import Sales Data</p>
            <p className="text-gray-400 text-sm mt-1">CSV sales data will appear here</p>
          </div>
        </div>
      </div>

      {/* Empty Category Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
        <div className="h-80 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-gray-500 font-medium">Import Sales Data</p>
            <p className="text-gray-400 text-sm mt-1">CSV category data will appear here</p>
          </div>
        </div>
      </div>

      {/* Empty Items Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Items</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-500 font-medium">Import Sales Data</p>
            <p className="text-gray-400 text-sm mt-1">CSV item performance will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}