'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface TimePeriodData {
  timeFilter: {
    start: string;
    end: string;
  };
  analysisType: 'category' | 'item';
  groupBy: 'daily' | 'weekly' | 'monthly';
  dateRange: {
    start: number | null;
    end: number | null;
  };
  summary: {
    totalRecords: number;
    totalRevenue: number;
    totalQuantity: number;
    periodsAnalyzed: number;
    averageRevenuePerPeriod: number;
  };
  data: Array<{
    period: string;
    items: Array<{
      name: string;
      quantity: number;
      revenue: number;
      count: number;
      averagePerOccurrence: number;
    }>;
    totalRevenue: number;
    totalQuantity: number;
    itemCount: number;
  }>;
  topPerformers: Array<{
    name: string;
    quantity: number;
    revenue: number;
    count: number;
    averagePerOccurrence: number;
  }>;
}

interface FilterOption {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  recordCount: number;
}

interface FilterOptionsResponse {
  type: 'category' | 'item';
  options: FilterOption[];
  count: number;
}

// Predefined time periods
const TIME_PERIODS = [
  { label: 'Morning Rush (8:00-10:00)', start: '08:00', end: '10:00' },
  { label: 'Late Morning (10:00-12:00)', start: '10:00', end: '12:00' },
  { label: 'Lunch Time (12:00-14:00)', start: '12:00', end: '14:00' },
  { label: 'Afternoon (14:00-17:00)', start: '14:00', end: '17:00' },
  { label: 'Business Hours (8:00-17:00)', start: '08:00', end: '17:00' },
  { label: 'Extended Hours (7:00-19:00)', start: '07:00', end: '19:00' },
  { label: 'Custom', start: '', end: '' },
];

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
];

export function TimePeriodAnalysis() {
  const [timeStart, setTimeStart] = useState<string>('08:00');
  const [timeEnd, setTimeEnd] = useState<string>('17:00');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>('Business Hours (8:00-17:00)');
  const [groupBy, setGroupBy] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [analysisType, setAnalysisType] = useState<'category' | 'item'>('category');
  const [filterBy, setFilterBy] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Handle preset time period selection
  const handleTimePeriodChange = (value: string) => {
    setSelectedTimePeriod(value);
    const period = TIME_PERIODS.find(p => p.label === value);
    if (period && period.start && period.end) {
      setTimeStart(period.start);
      setTimeEnd(period.end);
    }
  };

  // Fetch filter options based on analysis type
  const { data: filterOptions } = useQuery<FilterOptionsResponse>({
    queryKey: ['filter-options', analysisType],
    queryFn: async () => {
      const response = await fetch(`/api/sales/filter-options?type=${analysisType}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch filter options');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch filter options');
      return result.data;
    },
  });

  // Reset filter when analysis type changes
  useEffect(() => {
    setFilterBy('');
  }, [analysisType]);

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams({
      timeStart,
      timeEnd,
      groupBy,
      analysisType,
      limit: limit.toString(),
    });
    if (filterBy) {
      params.set('filterBy', filterBy);
    }
    return params.toString();
  };

  // Fetch time period analysis
  const { data: analysisData, isLoading, refetch } = useQuery<TimePeriodData>({
    queryKey: ['time-period-analysis', timeStart, timeEnd, groupBy, analysisType, filterBy, limit],
    queryFn: async () => {
      const response = await fetch(`/api/sales/time-period-analysis?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch time period analysis');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch time period analysis');
      return result.data;
    },
  });

  const handleRunAnalysis = () => {
    refetch();
  };

  // Prepare chart data for revenue trends
  const revenueChartData = analysisData?.data.map(period => ({
    period: period.period.length > 20 ? period.period.substring(0, 20) + '...' : period.period,
    revenue: period.totalRevenue,
    quantity: period.totalQuantity,
    itemCount: period.itemCount,
  })) || [];

  // Prepare data for top performers chart
  const topPerformersChartData = analysisData?.topPerformers.map((performer, index) => ({
    name: performer.name.length > 15 ? performer.name.substring(0, 15) + '...' : performer.name,
    revenue: performer.revenue,
    quantity: performer.quantity,
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
        <CardTitle className="flex items-center space-x-2">
          <span>⏰</span>
          <span>Time Period Sales Analysis</span>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Analyze sales performance by specific time periods and date ranges
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
          {/* Time Period Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <Select value={selectedTimePeriod} onValueChange={handleTimePeriodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((period) => (
                  <SelectItem key={period.label} value={period.label}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Time Start */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => {
                setTimeStart(e.target.value);
                setSelectedTimePeriod('Custom');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Custom Time End */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => {
                setTimeEnd(e.target.value);
                setSelectedTimePeriod('Custom');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Analysis Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analyze By
            </label>
            <Select value={analysisType} onValueChange={(value: 'category' | 'item') => setAnalysisType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Categories</SelectItem>
                <SelectItem value="item">Items</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group By
            </label>
            <Select value={groupBy} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setGroupBy(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter By Specific Item/Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter {analysisType === 'category' ? 'Category' : 'Item'}
            </label>
            <SearchableSelect
              options={[
                {
                  value: 'all',
                  label: `All ${analysisType === 'category' ? 'categories' : 'items'}`,
                  subtitle: ''
                },
                ...(filterOptions?.options.map(option => ({
                  value: option.name,
                  label: option.name,
                  subtitle: `${formatCurrency(option.totalRevenue)} revenue, ${option.totalQuantity.toLocaleString()} units`
                })) || [])
              ]}
              value={filterBy || 'all'}
              onValueChange={(value) => setFilterBy(value === 'all' ? '' : value)}
              placeholder={`All ${analysisType === 'category' ? 'categories' : 'items'}`}
              searchPlaceholder={`Search ${analysisType === 'category' ? 'categories' : 'items'}...`}
              className="w-full"
            />
          </div>

          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Type
            </label>
            <Select value={chartType} onValueChange={(value: 'bar' | 'pie') => setChartType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Run Analysis Button */}
        <div className="mb-6">
          <Button onClick={handleRunAnalysis} disabled={isLoading}>
            {isLoading ? '🔄 Analyzing...' : '🚀 Run Analysis'}
          </Button>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Analyzing time periods...</p>
            </div>
          </div>
        ) : analysisData ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(analysisData.summary.totalRevenue)}
                </p>
                <p className="text-xs text-gray-500">{analysisData.timeFilter.start}-{analysisData.timeFilter.end}</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Total Quantity</p>
                <p className="text-lg font-bold text-green-600">
                  {analysisData.summary.totalQuantity.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">items sold</p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Periods Analyzed</p>
                <p className="text-lg font-bold text-purple-600">
                  {analysisData.summary.periodsAnalyzed}
                </p>
                <p className="text-xs text-gray-500">{groupBy} periods</p>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Avg per Period</p>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(analysisData.summary.averageRevenuePerPeriod)}
                </p>
                <p className="text-xs text-gray-500">per {groupBy.slice(0, -2)}</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Revenue Trend Chart */}
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">Revenue Trend ({groupBy})</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData} margin={{ bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        name === 'revenue' ? formatCurrency(Number(value)) : Number(value).toFixed(1),
                        name === 'revenue' ? 'Revenue' : 
                        name === 'quantity' ? 'Quantity' : 'Items'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top Performers Chart */}
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-4">
                  {filterBy ? `${filterBy}` : `Top ${analysisType === 'category' ? 'Categories' : 'Items'}`}
                  <span className="text-sm text-gray-500 ml-2">({analysisData.timeFilter.start}-{analysisData.timeFilter.end})</span>
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={topPerformersChartData} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          name === 'revenue' ? formatCurrency(Number(value)) : Number(value).toFixed(1),
                          name === 'revenue' ? 'Revenue' : 'Quantity'
                        ]}
                      />
                      <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
                        {topPerformersChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={topPerformersChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => 
                          `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {topPerformersChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                      />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Period Breakdown */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Detailed Period Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3">Period</th>
                      <th className="text-right p-3">Revenue</th>
                      <th className="text-right p-3">Quantity</th>
                      <th className="text-right p-3">Top {analysisType === 'category' ? 'Category' : 'Item'}</th>
                      <th className="text-right p-3">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.data.map((period, index) => {
                      const topItem = period.items[0];
                      const avgRevenue = analysisData.summary.averageRevenuePerPeriod;
                      const performance = avgRevenue > 0 ? (period.totalRevenue / avgRevenue) : 1;
                      
                      return (
                        <tr key={period.period} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 font-medium">
                            {period.period}
                          </td>
                          <td className="text-right p-3 text-green-600">
                            {formatCurrency(period.totalRevenue)}
                          </td>
                          <td className="text-right p-3">
                            {period.totalQuantity.toFixed(1)}
                          </td>
                          <td className="text-right p-3">
                            {topItem ? (
                              <div>
                                <div className="font-medium">{topItem.name}</div>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(topItem.revenue)}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="text-right p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              performance >= 1.2 ? 'bg-green-100 text-green-800' :
                              performance >= 0.8 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {((performance - 1) * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Performers Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Top {analysisType === 'category' ? 'Categories' : 'Items'} Summary
                </h3>
                <div className="space-y-3">
                  {analysisData.topPerformers.slice(0, 5).map((performer, index) => (
                    <div key={performer.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <div>
                          <p className="font-medium text-gray-900">{performer.name}</p>
                          <p className="text-xs text-gray-500">
                            {performer.quantity.toFixed(1)} units sold
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(performer.revenue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(performer.averagePerOccurrence)} avg
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Analysis Insights</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Time Period Impact</p>
                    <p className="text-xs text-blue-600">
                      Sales during {analysisData.timeFilter.start}-{analysisData.timeFilter.end} represent 
                      {' '}{((analysisData.summary.totalRevenue / (analysisData.summary.totalRevenue / 0.6)) * 100).toFixed(0)}% 
                      of estimated daily business
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800">Best Performing Period</p>
                    <p className="text-xs text-green-600">
                      {analysisData.data.length > 0 ? 
                        analysisData.data.reduce((max, period) => 
                          period.totalRevenue > max.totalRevenue ? period : max
                        ).period : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-800">Analysis Type</p>
                    <p className="text-xs text-purple-600">
                      Showing top {analysisType === 'category' ? 'categories' : 'items'} 
                      {' '}grouped by {groupBy} periods
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">⏰</div>
              <p className="text-gray-500 font-medium">Configure your time period and click "Run Analysis"</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}