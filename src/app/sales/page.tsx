'use client';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { FileUpload } from '@/components/ui/file-upload';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { CategoryChart } from '@/components/charts/category-chart';
import { useSalesSummary, useSalesTimeSeries, useUploadSalesReport, SalesFilters } from '@/hooks/useSales';
import { formatCurrency, formatDate } from '@/lib/format';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'pie', label: 'Pie Chart' },
];

const CATEGORIES = [
  { value: 'House', label: 'House' },
  { value: 'Bulk', label: 'Bulk' },
  { value: 'Fruit & Veg', label: 'Fruit & Veg' },
  { value: 'Fridge & Freezer', label: 'Fridge & Freezer' },
  { value: 'Naturo', label: 'Naturo' },
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Drinks Fridge', label: 'Drinks Fridge' },
  { value: 'Supplements', label: 'Supplements' },
  { value: 'Personal Care', label: 'Personal Care' },
  { value: 'Fresh Bread', label: 'Fresh Bread' },
];

export default function SalesAnalyticsPage() {
  const [filters, setFilters] = useState<SalesFilters>({});
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [showUpload, setShowUpload] = useState(false);

  const uploadMutation = useUploadSalesReport();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useSalesSummary(filters);
  const { data: timeSeries, isLoading: timeSeriesLoading } = useSalesTimeSeries(filters);

  const handleFilterChange = (key: keyof SalesFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleFileUpload = async (file: File) => {
    try {
      await uploadMutation.mutateAsync(file);
      setShowUpload(false);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const hasFilters = Object.values(filters).some(value => value !== undefined && value !== '');

  if (summaryError) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Sales Data</h2>
            <p className="text-gray-600">Unable to load sales analytics. Please try again later.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
            <p className="text-gray-600">Real-time Square POS integration - uploaded data cleared</p>
            {summary && summary.overview.totalRevenue > 0 && (
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-600">Live Square Data</span>
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">
                  Updates every 30 seconds
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">
                  ${summary.overview.totalRevenue.toFixed(2)} total revenue
                </span>
              </div>
            )}
            {summary && summary.overview.totalRevenue === 0 && (
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-blue-600">Database Clean</span>
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">
                  Only live Square data will be used
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={() => setShowUpload(!showUpload)} variant="outline">
              📤 {showUpload ? 'Cancel Upload' : 'Upload CSV'}
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Square Sales Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FileUpload
                  onFileSelect={handleFileUpload}
                  accept=".csv"
                  maxSize={50}
                  disabled={uploadMutation.isPending}
                >
                  <div className="space-y-4">
                    <div className="text-4xl">📄</div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Drop your Square "Item Sales Detail" CSV here
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Export from Square Dashboard → Analytics → Items → Export
                      </p>
                    </div>
                    <Button variant="secondary" disabled={uploadMutation.isPending}>
                      {uploadMutation.isPending ? 'Uploading...' : 'Choose CSV File'}
                    </Button>
                  </div>
                </FileUpload>

                {uploadMutation.isError && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                    Upload failed: {uploadMutation.error?.message}
                  </div>
                )}

                {uploadMutation.isSuccess && (
                  <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
                    Sales report uploaded successfully! Data will appear in charts below.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters & Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select
                placeholder="All Categories"
                options={CATEGORIES}
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
              />

              <Input
                placeholder="Search items..."
                value={filters.itemName || ''}
                onChange={(e) => handleFilterChange('itemName', e.target.value || undefined)}
              />

              <Input
                type="date"
                placeholder="Start Date"
                value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
              />

              <Input
                type="date"
                placeholder="End Date"
                value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-4">
                <Select
                  placeholder="Chart Type"
                  options={CHART_TYPES}
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as 'bar' | 'pie')}
                />
                {hasFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>

              {summary && (
                <div className="text-sm text-gray-600">
                  {summary.overview.reportCount} reports loaded
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overview Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600">💰</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(summary.overview.totalRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">📦</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Items Sold</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.overview.totalQuantity.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600">📊</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Categories</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.topCategories.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600">📅</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Date Range</p>
                    <p className="text-sm font-bold text-gray-900">
                      {summary.overview.dateRange.start 
                        ? `${formatDate(summary.overview.dateRange.start)} - ${formatDate(summary.overview.dateRange.end!)}`
                        : 'No data'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {timeSeriesLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <RevenueChart 
                  data={timeSeries?.timeSeries || []} 
                  height={300}
                />
              )}
            </CardContent>
          </Card>

          {/* Category Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <CategoryChart 
                  data={summary?.topCategories || []}
                  type={chartType}
                  height={300}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Items Table */}
        {summary && summary.topItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.topItems.map((item, index) => (
                      <tr key={item.itemName} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.percentage.toFixed(1)}%
                        </td>
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