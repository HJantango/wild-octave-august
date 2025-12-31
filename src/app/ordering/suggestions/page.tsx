'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OrderSuggestion {
  id: string;
  vendorId: string;
  suggestedQuantity: number;
  priority: 'high' | 'medium' | 'low';
  periodAnalyzed: string;
  salesVelocity?: number;
  daysOfStock?: number;
  reasoning: {
    currentStock: number;
    minimumStock?: number;
    reorderPoint?: number;
    salesData?: {
      totalQuantity: number;
      avgDailyQuantity: number;
    };
    forecastDemand?: number;
    stockAfterForecast?: number;
  };
  inventoryItem: {
    id: string;
    item: {
      id: string;
      name: string;
      category: string;
      currentCostExGst: number;
    };
  };
}

interface SuggestionsByVendor {
  [vendorId: string]: {
    vendor: {
      id: string;
      name: string;
    };
    suggestions: OrderSuggestion[];
    totalItems: number;
    totalValue: number;
  };
}

interface SuggestionsResponse {
  suggestionsByVendor: SuggestionsByVendor;
  totalSuggestions: number;
  analysisWindow: number;
  forecastDays: number;
}

async function generateSuggestions({
  vendorId,
  analysisWindow = 30,
  forecastDays = 14,
}: {
  vendorId?: string;
  analysisWindow?: number;
  forecastDays?: number;
}): Promise<SuggestionsResponse> {
  const response = await fetch('/api/order-suggestions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorId,
      analysisWindow,
      forecastDays,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate suggestions');
  }
  return response.json();
}

async function createPurchaseOrderFromSuggestions({
  vendorId,
  suggestionIds,
  adjustments = {},
}: {
  vendorId: string;
  suggestionIds: string[];
  adjustments?: Record<string, number>;
}) {
  const response = await fetch(`/api/order-suggestions/${vendorId}/create-po`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suggestionIds,
      adjustments,
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
      createdBy: 'system',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create purchase order');
  }
  return response.json();
}

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

function VendorSuggestions({
  vendorData,
  onCreatePurchaseOrder,
}: {
  vendorData: SuggestionsByVendor[string];
  onCreatePurchaseOrder: (vendorId: string, suggestionIds: string[], adjustments: Record<string, number>) => void;
}) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const handleSuggestionToggle = (suggestionId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(suggestionId)) {
      newSelected.delete(suggestionId);
    } else {
      newSelected.add(suggestionId);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleQuantityChange = (suggestionId: string, quantity: string) => {
    setAdjustments(prev => ({
      ...prev,
      [suggestionId]: quantity,
    }));
  };

  const handleCreateOrder = () => {
    const adjustmentNumbers = Object.entries(adjustments).reduce((acc, [id, qty]) => {
      const numericQty = parseFloat(qty);
      if (!isNaN(numericQty) && numericQty > 0) {
        acc[id] = numericQty;
      }
      return acc;
    }, {} as Record<string, number>);

    onCreatePurchaseOrder(vendorData.vendor.id, Array.from(selectedSuggestions), adjustmentNumbers);
  };

  const selectedValue = vendorData.suggestions
    .filter(suggestion => selectedSuggestions.has(suggestion.id))
    .reduce((sum, suggestion) => {
      const quantity = adjustments[suggestion.id] 
        ? parseFloat(adjustments[suggestion.id]) 
        : suggestion.suggestedQuantity;
      return sum + (quantity * suggestion.inventoryItem.item.currentCostExGst);
    }, 0);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>🏪</span>
              <span>{vendorData.vendor.name}</span>
            </CardTitle>
            <CardDescription>
              {vendorData.totalItems} items • Total value: {formatCurrency(vendorData.totalValue)}
            </CardDescription>
          </div>
          <div className="text-right">
            {selectedSuggestions.size > 0 && (
              <div className="text-sm text-blue-600 mb-2">
                Selected: {formatCurrency(selectedValue)}
              </div>
            )}
            <Button
              onClick={handleCreateOrder}
              disabled={selectedSuggestions.size === 0}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600"
            >
              Create Order ({selectedSuggestions.size})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {vendorData.suggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50">
              <Checkbox
                checked={selectedSuggestions.has(suggestion.id)}
                onCheckedChange={() => handleSuggestionToggle(suggestion.id)}
              />
              
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="font-medium text-gray-900">{suggestion.inventoryItem.item.name}</h4>
                  <Badge className={priorityColors[suggestion.priority]}>
                    {suggestion.priority} priority
                  </Badge>
                  <span className="text-sm text-gray-500">{suggestion.inventoryItem.item.category}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Current:</span> {suggestion.reasoning.currentStock}
                  </div>
                  <div>
                    <span className="font-medium">Suggested:</span> {suggestion.suggestedQuantity}
                  </div>
                  {suggestion.daysOfStock && (
                    <div>
                      <span className="font-medium">Days of stock:</span> {Math.round(suggestion.daysOfStock)}
                    </div>
                  )}
                  {suggestion.salesVelocity && (
                    <div>
                      <span className="font-medium">Daily sales:</span> {suggestion.salesVelocity.toFixed(1)}
                    </div>
                  )}
                </div>

                {suggestion.reasoning.salesData && (
                  <div className="mt-2 text-xs text-gray-500">
                    Analysis: {suggestion.reasoning.salesData.totalQuantity} sold in {suggestion.periodAnalyzed.replace('_', ' ')}
                    {suggestion.reasoning.forecastDemand && (
                      <span> • Forecast demand: {suggestion.reasoning.forecastDemand.toFixed(1)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(suggestion.inventoryItem.item.currentCostExGst)}
                  </div>
                  <div className="text-xs text-gray-500">per unit</div>
                </div>
                
                <div className="w-24">
                  <Label htmlFor={`qty-${suggestion.id}`} className="sr-only">
                    Quantity
                  </Label>
                  <Input
                    id={`qty-${suggestion.id}`}
                    type="number"
                    step="0.01"
                    placeholder={suggestion.suggestedQuantity.toString()}
                    value={adjustments[suggestion.id] || ''}
                    onChange={(e) => handleQuantityChange(suggestion.id, e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="text-right w-20">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(
                      (adjustments[suggestion.id] 
                        ? parseFloat(adjustments[suggestion.id]) 
                        : suggestion.suggestedQuantity
                      ) * suggestion.inventoryItem.item.currentCostExGst
                    )}
                  </div>
                  <div className="text-xs text-gray-500">total</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrderSuggestionsPage() {
  const [analysisWindow, setAnalysisWindow] = useState(30);
  const [forecastDays, setForecastDays] = useState(14);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  
  const queryClient = useQueryClient();

  const { 
    data: suggestions, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['orderSuggestions', selectedVendor, analysisWindow, forecastDays],
    queryFn: () => generateSuggestions({
      vendorId: selectedVendor === 'all' ? undefined : selectedVendor,
      analysisWindow,
      forecastDays,
    }),
    enabled: false, // Only run when explicitly called
  });

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrderFromSuggestions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
  });

  const handleGenerateSuggestions = () => {
    refetch();
  };

  const handleCreatePurchaseOrder = (
    vendorId: string, 
    suggestionIds: string[], 
    adjustments: Record<string, number>
  ) => {
    createOrderMutation.mutate({
      vendorId,
      suggestionIds,
      adjustments,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              🤖 AI Order Suggestions
              <span className="ml-3 flex items-center text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-300 mr-1"></span>
                Smart Analytics
              </span>
            </h1>
            <p className="text-purple-100 text-lg">
              Intelligent recommendations based on sales data and inventory levels
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Order Suggestions</CardTitle>
            <CardDescription>
              Configure analysis parameters to generate intelligent ordering recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="analysis-window">Analysis Window (days)</Label>
                <Select value={analysisWindow.toString()} onValueChange={(value) => setAnalysisWindow(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="forecast-days">Forecast Period (days)</Label>
                <Select value={forecastDays.toString()} onValueChange={(value) => setForecastDays(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="21">21 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vendor-filter">Vendor Filter</Label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {/* Would need to fetch vendors list here */}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleGenerateSuggestions}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                >
                  {isLoading ? 'Analyzing...' : '🔍 Generate Suggestions'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 text-red-700">
                <span className="text-xl">❌</span>
                <div>
                  <p className="font-medium">Error generating suggestions</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {createOrderMutation.error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 text-red-700">
                <span className="text-xl">❌</span>
                <div>
                  <p className="font-medium">Error creating purchase order</p>
                  <p className="text-sm">{createOrderMutation.error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {createOrderMutation.isSuccess && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 text-green-700">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-medium">Purchase order created successfully!</p>
                  <p className="text-sm">Check the Purchase Orders page to view and manage your new order.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {suggestions && (
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total Suggestions:</span>
                    <span className="font-medium ml-2">{suggestions.totalSuggestions}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vendors:</span>
                    <span className="font-medium ml-2">{Object.keys(suggestions.suggestionsByVendor).length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Analysis Period:</span>
                    <span className="font-medium ml-2">{suggestions.analysisWindow} days</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Forecast Period:</span>
                    <span className="font-medium ml-2">{suggestions.forecastDays} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendor Suggestions */}
            {Object.entries(suggestions.suggestionsByVendor).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(suggestions.suggestionsByVendor).map(([vendorId, vendorData]) => (
                  <VendorSuggestions
                    key={vendorId}
                    vendorData={vendorData}
                    onCreatePurchaseOrder={handleCreatePurchaseOrder}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <span className="text-4xl mb-2 block">🎯</span>
                  <p className="font-medium">No ordering suggestions found</p>
                  <p className="text-sm">
                    All items appear to be well-stocked based on your current inventory levels and sales data.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!suggestions && !isLoading && !error && (
          <Card className="border-2 border-dashed border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Order Suggestions</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Generate intelligent ordering recommendations based on your sales data, inventory levels, 
                and ordering patterns. Click "Generate Suggestions" to get started.
              </p>
              <Button 
                onClick={handleGenerateSuggestions}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <span className="mr-2">🔍</span>
                Generate Your First Suggestions
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}