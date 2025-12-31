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
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatCurrency } from '@/lib/format';

const WEEKDAY_COLORS = [
  '#EF4444', // Sunday - Red
  '#3B82F6', // Monday - Blue  
  '#10B981', // Tuesday - Green
  '#F59E0B', // Wednesday - Yellow
  '#8B5CF6', // Thursday - Purple
  '#06B6D4', // Friday - Cyan
  '#F97316', // Saturday - Orange
];

interface WeekdayData {
  dayOfWeek: number;
  dayName: string;
  quantity: number;
  revenue: number;
  count: number;
  averageQuantity: number;
  averageRevenue: number;
  weeklyAverageQuantity?: number;
  weeklyAverageRevenue?: number;
}

interface ItemsListResponse {
  items: Array<{
    name: string;
    totalQuantity: number;
    totalRevenue: number;
    recordCount: number;
  }>;
  count: number;
}

interface WeekdayAnalysisResponse {
  itemName: string;
  weekdayData: WeekdayData[];
  totals: {
    totalQuantity: number;
    totalRevenue: number;
    totalDays: number;
    dateRange: {
      start: number | null;
      end: number | null;
    };
  };
}

export function WeekdayAnalysis() {
  const [selectedItem, setSelectedItem] = useState<string>('');

  // Fetch items list
  const { data: itemsData } = useQuery<ItemsListResponse>({
    queryKey: ['items-list'],
    queryFn: async () => {
      const response = await fetch('/api/sales/items-list');
      if (!response.ok) throw new Error('Failed to fetch items');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch items');
      return result.data;
    },
  });

  // Auto-select first item when items load
  useEffect(() => {
    if (itemsData?.items?.length > 0 && !selectedItem) {
      setSelectedItem(itemsData.items[0].name);
    }
  }, [itemsData, selectedItem]);

  // Fetch weekday analysis for selected item
  const { data: weekdayData, isLoading } = useQuery<WeekdayAnalysisResponse>({
    queryKey: ['item-weekday-analysis', selectedItem],
    queryFn: async () => {
      if (!selectedItem) throw new Error('No item selected');
      
      const response = await fetch(`/api/sales/item-by-weekday?itemName=${encodeURIComponent(selectedItem)}`);
      if (!response.ok) throw new Error('Failed to fetch weekday analysis');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch weekday analysis');
      return result.data;
    },
    enabled: !!selectedItem,
  });

  if (!itemsData?.items?.length) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Item Sales by Day of Week</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>Loading items...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalQuantityAllDays = weekdayData?.weekdayData.reduce((sum, day) => sum + day.quantity, 0) || 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>📊</span>
              <span>Item Sales by Day of Week</span>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Analyze daily patterns for specific items
            </p>
          </div>
          <div className="min-w-[300px]">
            <SearchableSelect
              options={itemsData.items.map(item => ({
                value: item.name,
                label: item.name,
                subtitle: `${item.totalQuantity.toLocaleString()} sold, ${formatCurrency(item.totalRevenue)} revenue`
              }))}
              value={selectedItem}
              onValueChange={setSelectedItem}
              placeholder="Select an item..."
              searchPlaceholder="Search products..."
              className="w-full"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Loading analysis...</p>
            </div>
          </div>
        ) : weekdayData ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">Total Quantity</p>
                <p className="text-lg font-bold text-blue-600">
                  {weekdayData.totals.totalQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {weekdayData.totals.dateRange.start && weekdayData.totals.dateRange.end
                    ? `${new Date(weekdayData.totals.dateRange.start).toLocaleDateString()} - ${new Date(weekdayData.totals.dateRange.end).toLocaleDateString()}`
                    : 'All time'
                  }
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(weekdayData.totals.totalRevenue)}
                </p>
                <p className="text-xs text-gray-500">
                  {weekdayData.totals.totalQuantity > 0
                    ? formatCurrency(weekdayData.totals.totalRevenue / weekdayData.totals.totalQuantity)
                    : '$0'} avg per item
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">Sales Days</p>
                <p className="text-lg font-bold text-purple-600">
                  {weekdayData.totals.totalDays.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {weekdayData.totals.dateRange.start && weekdayData.totals.dateRange.end
                    ? `${Math.ceil((weekdayData.totals.dateRange.end - weekdayData.totals.dateRange.start) / (1000 * 60 * 60 * 24 * 7))} weeks period`
                    : 'date range unknown'
                  }
                </p>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600">Daily Average</p>
                <p className="text-lg font-bold text-orange-600">
                  {weekdayData.totals.totalDays > 0 
                    ? (weekdayData.totals.totalQuantity / weekdayData.totals.totalDays).toFixed(1)
                    : '0'
                  }
                </p>
                <p className="text-xs text-gray-500">per sales day</p>
              </div>
            </div>

            {/* Chart */}
            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData.weekdayData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dayName" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload as WeekdayData;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{label}</p>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Total Quantity:</span>
                              <span className="font-medium text-blue-600">
                                {data.quantity.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Avg per Day:</span>
                              <span className="font-medium text-green-600">
                                {data.averageQuantity.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Weekly Average:</span>
                              <span className="font-medium text-orange-600">
                                {data.weeklyAverageQuantity ? data.weeklyAverageQuantity.toFixed(1) : '0'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Revenue:</span>
                              <span className="font-medium text-purple-600">
                                {formatCurrency(data.revenue)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Days with Sales:</span>
                              <span className="font-medium text-gray-900">
                                {data.count}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="quantity" radius={[2, 2, 0, 0]}>
                    {weekdayData.weekdayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={WEEKDAY_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Day Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-2">Day</th>
                    <th className="text-right p-2">Total Qty</th>
                    <th className="text-right p-2">Avg per Day</th>
                    <th className="text-right p-2">Weekly Avg</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">% of Week</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdayData.weekdayData.map((day, index) => {
                    const percentage = totalQuantityAllDays > 0 
                      ? (day.quantity / totalQuantityAllDays) * 100 
                      : 0;
                    
                    return (
                      <tr key={day.dayName} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: WEEKDAY_COLORS[index] }}
                            ></div>
                            <span className="font-medium">{day.dayName}</span>
                          </div>
                        </td>
                        <td className="text-right p-2 font-medium">
                          {day.quantity.toLocaleString()}
                        </td>
                        <td className="text-right p-2 text-gray-600">
                          {day.averageQuantity.toFixed(1)}
                        </td>
                        <td className="text-right p-2 text-blue-600">
                          {day.weeklyAverageQuantity ? day.weeklyAverageQuantity.toFixed(1) : '0'}
                        </td>
                        <td className="text-right p-2 text-green-600">
                          {formatCurrency(day.revenue)}
                        </td>
                        <td className="text-right p-2 text-purple-600">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <p className="text-gray-500 font-medium">Select an item to view analysis</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}