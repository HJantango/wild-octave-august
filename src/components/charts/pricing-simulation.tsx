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
  Legend,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface PricingSimulationData {
  itemName: string;
  dateRange: {
    start: number | null;
    end: number | null;
  };
  simulation: {
    currentStats: {
      totalQuantity: number;
      totalRevenue: number;
      averagePrice: number;
      periodsAnalyzed: number;
    };
    primaryScenario: {
      newTotalRevenue: number;
      additionalRevenue: number;
      newAveragePrice: number;
      markupDescription: string;
    };
    secondaryScenario?: {
      newTotalRevenue: number;
      additionalRevenue: number;
      newAveragePrice: number;
      markupDescription: string;
    };
    comparison?: {
      revenueDifference: number;
      additionalRevenueDifference: number;
      betterOption: 'primary' | 'secondary';
    };
    periodProjections: Array<{
      period: string;
      currentRevenue: number;
      projectedRevenue: number;
      additionalRevenue: number;
      quantity: number;
    }>;
  };
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

export function PricingSimulation() {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [primaryMarkupType, setPrimaryMarkupType] = useState<'percentage' | 'dollar'>('percentage');
  const [primaryMarkupValue, setPrimaryMarkupValue] = useState<number>(3);
  const [secondaryMarkupType, setSecondaryMarkupType] = useState<'percentage' | 'dollar'>('dollar');
  const [secondaryMarkupValue, setSecondaryMarkupValue] = useState<number>(0.50);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [useSecondaryComparison, setUseSecondaryComparison] = useState<boolean>(true);

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

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams({
      itemName: selectedItem,
      primaryMarkupType,
      primaryMarkupValue: primaryMarkupValue.toString(),
      periodType,
    });

    if (useSecondaryComparison) {
      params.set('secondaryMarkupType', secondaryMarkupType);
      params.set('secondaryMarkupValue', secondaryMarkupValue.toString());
    }

    return params.toString();
  };

  // Fetch pricing simulation
  const { data: simulationData, isLoading, refetch } = useQuery<PricingSimulationData>({
    queryKey: ['pricing-simulation', selectedItem, primaryMarkupType, primaryMarkupValue, secondaryMarkupType, secondaryMarkupValue, periodType, useSecondaryComparison],
    queryFn: async () => {
      if (!selectedItem) throw new Error('No item selected');
      
      const response = await fetch(`/api/sales/pricing-simulation?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch pricing simulation');
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || 'Failed to fetch pricing simulation');
      return result.data;
    },
    enabled: !!selectedItem,
  });

  const handleRunSimulation = () => {
    refetch();
  };

  // Prepare chart data
  const chartData = simulationData?.simulation?.periodProjections?.map(projection => ({
    period: projection.period,
    current: projection.currentRevenue,
    projected: projection.projectedRevenue,
    additional: projection.additionalRevenue,
  })) || [];

  if (!itemsData?.items?.length) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Pricing Simulation</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>Loading items...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="flex items-center space-x-2">
          <span>💰</span>
          <span>Pricing Simulation</span>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Simulate different markup strategies and compare potential revenue impacts
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product
            </label>
            <SearchableSelect
              options={itemsData.items.map(item => ({
                value: item.name,
                label: item.name,
                subtitle: `${item.totalQuantity.toLocaleString()} sold, ${formatCurrency(item.totalRevenue)} revenue`
              }))}
              value={selectedItem}
              onValueChange={setSelectedItem}
              placeholder="Select product..."
              searchPlaceholder="Search products..."
              className="w-full"
            />
          </div>

          {/* Primary Markup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Markup
            </label>
            <div className="flex space-x-2">
              <Select value={primaryMarkupType} onValueChange={(value: 'percentage' | 'dollar') => setPrimaryMarkupType(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="dollar">$</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="number"
                step={primaryMarkupType === 'percentage' ? '0.1' : '0.01'}
                min="0"
                value={primaryMarkupValue}
                onChange={(e) => setPrimaryMarkupValue(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={primaryMarkupType === 'percentage' ? '3.0' : '0.50'}
              />
            </div>
          </div>

          {/* Secondary Markup Toggle & Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={useSecondaryComparison}
                onChange={(e) => setUseSecondaryComparison(e.target.checked)}
                className="mr-2"
              />
              Compare with
            </label>
            <div className={`flex space-x-2 ${!useSecondaryComparison ? 'opacity-50' : ''}`}>
              <Select 
                value={secondaryMarkupType} 
                onValueChange={(value: 'percentage' | 'dollar') => setSecondaryMarkupType(value)}
                disabled={!useSecondaryComparison}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="dollar">$</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="number"
                step={secondaryMarkupType === 'percentage' ? '0.1' : '0.01'}
                min="0"
                value={secondaryMarkupValue}
                onChange={(e) => setSecondaryMarkupValue(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={secondaryMarkupType === 'percentage' ? '5.0' : '0.75'}
                disabled={!useSecondaryComparison}
              />
            </div>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Period
            </label>
            <Select value={periodType} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setPeriodType(value)}>
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
        </div>

        {/* Run Simulation Button */}
        <div className="mb-6">
          <Button onClick={handleRunSimulation} disabled={isLoading}>
            {isLoading ? '🔄 Calculating...' : '🚀 Run Simulation'}
          </Button>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Running simulation...</p>
            </div>
          </div>
        ) : simulationData?.simulation ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Current Price</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(simulationData.simulation.currentStats.averagePrice)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">New Price (Primary)</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(simulationData.simulation.primaryScenario.newAveragePrice)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Additional Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(simulationData.simulation.primaryScenario.additionalRevenue)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600">Periods Analyzed</p>
                <p className="text-lg font-bold text-purple-600">
                  {simulationData.simulation.currentStats.periodsAnalyzed}
                </p>
              </div>
            </div>

            {/* Comparison Table */}
            {simulationData.simulation.secondaryScenario && simulationData.simulation.comparison && (
              <div className="mb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3">Scenario</th>
                      <th className="text-right p-3">New Price</th>
                      <th className="text-right p-3">Additional Revenue</th>
                      <th className="text-right p-3">Total Revenue</th>
                      <th className="text-center p-3">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={`border-b border-gray-100 ${simulationData.simulation.comparison.betterOption === 'primary' ? 'bg-green-50' : ''}`}>
                      <td className="p-3 font-medium">
                        Primary ({simulationData.simulation.primaryScenario.markupDescription})
                      </td>
                      <td className="text-right p-3">
                        {formatCurrency(simulationData.simulation.primaryScenario.newAveragePrice)}
                      </td>
                      <td className="text-right p-3 text-green-600">
                        {formatCurrency(simulationData.simulation.primaryScenario.additionalRevenue)}
                      </td>
                      <td className="text-right p-3">
                        {formatCurrency(simulationData.simulation.primaryScenario.newTotalRevenue)}
                      </td>
                      <td className="text-center p-3">
                        {simulationData.simulation.comparison.betterOption === 'primary' && (
                          <span className="text-green-600 font-medium">✓ Better</span>
                        )}
                      </td>
                    </tr>
                    <tr className={`border-b border-gray-100 ${simulationData.simulation.comparison.betterOption === 'secondary' ? 'bg-green-50' : ''}`}>
                      <td className="p-3 font-medium">
                        Secondary ({simulationData.simulation.secondaryScenario.markupDescription})
                      </td>
                      <td className="text-right p-3">
                        {formatCurrency(simulationData.simulation.secondaryScenario.newAveragePrice)}
                      </td>
                      <td className="text-right p-3 text-green-600">
                        {formatCurrency(simulationData.simulation.secondaryScenario.additionalRevenue)}
                      </td>
                      <td className="text-right p-3">
                        {formatCurrency(simulationData.simulation.secondaryScenario.newTotalRevenue)}
                      </td>
                      <td className="text-center p-3">
                        {simulationData.simulation.comparison.betterOption === 'secondary' && (
                          <span className="text-green-600 font-medium">✓ Better</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Revenue Projection Chart */}
            <div className="h-80 mb-6">
              <h3 className="text-lg font-semibold mb-4">Revenue Projection by {periodType.charAt(0).toUpperCase() + periodType.slice(1)}</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'current' ? 'Current Revenue' :
                      name === 'projected' ? 'Projected Revenue' : 'Additional Revenue'
                    ]}
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="current" fill="#94A3B8" name="Current Revenue" />
                  <Bar dataKey="additional" fill="#10B981" name="Additional Revenue" />
                  <Line 
                    type="monotone" 
                    dataKey="projected" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    name="Projected Revenue"
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">💰</div>
              <p className="text-gray-500 font-medium">Configure your simulation and click "Run Simulation"</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}