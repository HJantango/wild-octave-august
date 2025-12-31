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
import { formatCurrency, formatDate } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, TrendingUp, Package, AlertTriangle, CheckCircle2, Clock, Upload, FileText } from 'lucide-react';

interface HistoricalSuggestion {
  itemName: string;
  category: string;
  vendorName: string;
  vendorId: string;
  orderFrequency: number;
  avgQuantity: number;
  avgUnitCost: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  typicalOrderInterval: number;
  nextSuggestedOrderDate: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

interface VendorSuggestions {
  vendor: {
    id: string;
    name: string;
  };
  suggestions: HistoricalSuggestion[];
  totalItems: number;
  estimatedOrderValue: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
}

interface HistoricalResponse {
  suggestionsByVendor: Record<string, VendorSuggestions>;
  totalSuggestions: number;
  analysisWindow: number;
  forecastWeeks: number;
  analysisStats: {
    invoicesAnalyzed: number;
    uniqueItemsFound: number;
    itemsQualifiedForSuggestion: number;
    oldestInvoiceDate: string;
    newestInvoiceDate: string;
  };
}

interface SelectedItem {
  itemName: string;
  quantity: number;
  unitCostExGst: number;
  notes?: string;
}

async function generateHistoricalSuggestions({
  vendorId,
  analysisMonths = 6,
  forecastWeeks = 2,
  minimumOrderFrequency = 2,
}: {
  vendorId?: string;
  analysisMonths?: number;
  forecastWeeks?: number;
  minimumOrderFrequency?: number;
}): Promise<HistoricalResponse> {
  const response = await fetch('/api/order-suggestions/historical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorId,
      analysisMonths,
      forecastWeeks,
      minimumOrderFrequency,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate historical suggestions');
  }
  return response.json();
}

async function checkInvoiceCount(): Promise<number> {
  const response = await fetch('/api/invoices?limit=1');
  if (!response.ok) {
    throw new Error('Failed to check invoices');
  }
  const data = await response.json();
  return data.total || 0;
}

async function createPurchaseOrderFromHistorical({
  vendorId,
  selectedItems,
  expectedDeliveryDate,
  notes,
}: {
  vendorId: string;
  selectedItems: SelectedItem[];
  expectedDeliveryDate?: string;
  notes?: string;
}) {
  const response = await fetch('/api/order-suggestions/historical/create-po', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorId,
      selectedItems,
      expectedDeliveryDate,
      notes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create purchase order');
  }
  return response.json();
}

export default function HistoricalOrderSuggestionsPage() {
  const [analysisMonths, setAnalysisMonths] = useState(6);
  const [forecastWeeks, setForecastWeeks] = useState(2);
  const [minimumOrderFrequency, setMinimumOrderFrequency] = useState(2);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Record<string, Record<string, SelectedItem>>>({});
  
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: suggestions,
    isLoading,
    error,
    refetch 
  } = useQuery({
    queryKey: ['historicalSuggestions', selectedVendor, analysisMonths, forecastWeeks, minimumOrderFrequency],
    queryFn: () => generateHistoricalSuggestions({
      vendorId: selectedVendor === 'all' ? undefined : selectedVendor,
      analysisMonths,
      forecastWeeks,
      minimumOrderFrequency,
    }),
    enabled: false, // Only run when explicitly called
  });

  const { data: invoiceCount } = useQuery({
    queryKey: ['invoiceCount'],
    queryFn: checkInvoiceCount,
  });

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrderFromHistorical,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // Clear selections for this vendor
      const vendorId = data.purchaseOrder.vendorId;
      setSelectedItems(prev => ({ ...prev, [vendorId]: {} }));
      alert(`Purchase order ${data.purchaseOrder.orderNumber} created successfully!`);
    },
    onError: (error) => {
      alert(`Failed to create purchase order: ${error.message}`);
    },
  });

  const handleGenerateSuggestions = () => {
    refetch();
  };

  const handleItemSelection = (vendorId: string, suggestion: HistoricalSuggestion, checked: boolean) => {
    setSelectedItems(prev => {
      const newSelected = { ...prev };
      if (!newSelected[vendorId]) {
        newSelected[vendorId] = {};
      }

      if (checked) {
        newSelected[vendorId][suggestion.itemName] = {
          itemName: suggestion.itemName,
          quantity: suggestion.avgQuantity,
          unitCostExGst: suggestion.avgUnitCost,
        };
      } else {
        delete newSelected[vendorId][suggestion.itemName];
      }

      return newSelected;
    });
  };

  const handleQuantityChange = (vendorId: string, itemName: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        [itemName]: {
          ...prev[vendorId]?.[itemName],
          quantity,
        }
      }
    }));
  };

  const handleCreatePurchaseOrder = (vendorId: string, vendorName: string) => {
    const items = Object.values(selectedItems[vendorId] || {});
    if (items.length === 0) {
      alert('Please select at least one item');
      return;
    }

    createOrderMutation.mutate({
      vendorId,
      selectedItems: items,
      notes: `Order based on historical analysis of past ${analysisMonths} months`,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle2 className="h-4 w-4" />;
      default: return null;
    }
  };

  const totalSelectedValue = (vendorId: string) => {
    const items = selectedItems[vendorId] || {};
    return Object.values(items).reduce((sum, item) => sum + (item.quantity * item.unitCostExGst), 0);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">📊 Historical Order Analysis</h1>
            <p className="text-gray-600 mt-2">
              Analyze your past invoices to generate intelligent reorder suggestions based on historical patterns.
            </p>
          </div>

          {/* Analysis Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Analysis Parameters</span>
              </CardTitle>
              <CardDescription>
                Configure the analysis period and filtering options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <Label htmlFor="analysisMonths">Analysis Period</Label>
                  <Select value={analysisMonths.toString()} onValueChange={(value) => setAnalysisMonths(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="18">18 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="minimumFrequency">Minimum Order Frequency</Label>
                  <Select value={minimumOrderFrequency.toString()} onValueChange={(value) => setMinimumOrderFrequency(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 time</SelectItem>
                      <SelectItem value="2">2 times</SelectItem>
                      <SelectItem value="3">3 times</SelectItem>
                      <SelectItem value="5">5 times</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="forecastWeeks">Forecast Period</Label>
                  <Select value={forecastWeeks.toString()} onValueChange={(value) => setForecastWeeks(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 week</SelectItem>
                      <SelectItem value="2">2 weeks</SelectItem>
                      <SelectItem value="4">4 weeks</SelectItem>
                      <SelectItem value="8">8 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vendor">Vendor Filter</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger>
                      <SelectValue placeholder="All vendors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {/* Would populate with actual vendors */}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleGenerateSuggestions}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              >
                {isLoading ? 'Analyzing Historical Data...' : '🔍 Analyze Invoice History'}
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {suggestions && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Total Suggestions</p>
                        <p className="text-2xl font-bold">{suggestions?.totalSuggestions || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Invoices Analyzed</p>
                        <p className="text-2xl font-bold">{suggestions?.analysisStats?.invoicesAnalyzed || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">Items Found</p>
                        <p className="text-2xl font-bold">{suggestions?.analysisStats?.uniqueItemsFound || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Vendors</p>
                        <p className="text-2xl font-bold">{suggestions?.suggestionsByVendor ? Object.keys(suggestions.suggestionsByVendor).length : 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Vendor Suggestions */}
              <div className="space-y-6">
                {suggestions?.suggestionsByVendor && Object.entries(suggestions.suggestionsByVendor).map(([vendorId, vendorData]) => (
                  <Card key={vendorId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center space-x-2">
                            <span>{vendorData.vendor.name}</span>
                            <div className="flex space-x-1">
                              {vendorData.highPriorityCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {vendorData.highPriorityCount} High
                                </Badge>
                              )}
                              {vendorData.mediumPriorityCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                  {vendorData.mediumPriorityCount} Medium
                                </Badge>
                              )}
                              {vendorData.lowPriorityCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  {vendorData.lowPriorityCount} Low
                                </Badge>
                              )}
                            </div>
                          </CardTitle>
                          <CardDescription>
                            {vendorData.totalItems} items • Est. value: {formatCurrency(vendorData.estimatedOrderValue)}
                            {Object.keys(selectedItems[vendorId] || {}).length > 0 && (
                              <span className="ml-2 font-medium text-blue-600">
                                • Selected: {formatCurrency(totalSelectedValue(vendorId))}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        
                        <Button
                          onClick={() => handleCreatePurchaseOrder(vendorId, vendorData.vendor.name)}
                          disabled={Object.keys(selectedItems[vendorId] || {}).length === 0 || createOrderMutation.isPending}
                          size="sm"
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        >
                          {createOrderMutation.isPending ? 'Creating...' : `Create PO (${Object.keys(selectedItems[vendorId] || {}).length})`}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {vendorData.suggestions.map((suggestion) => (
                          <div key={suggestion.itemName} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={!!selectedItems[vendorId]?.[suggestion.itemName]}
                                  onCheckedChange={(checked) => handleItemSelection(vendorId, suggestion, checked as boolean)}
                                />
                                
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-medium">{suggestion.itemName}</h4>
                                    <Badge variant="outline" className={`${getPriorityColor(suggestion.priority)} text-white text-xs`}>
                                      {getPriorityIcon(suggestion.priority)}
                                      <span className="ml-1">{suggestion.priority}</span>
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {suggestion.confidence * 100}% confidence
                                    </Badge>
                                  </div>
                                  
                                  <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                    <div>
                                      <span className="font-medium">Avg Qty:</span> {suggestion.avgQuantity}
                                    </div>
                                    <div>
                                      <span className="font-medium">Avg Cost:</span> {formatCurrency(suggestion.avgUnitCost)}
                                    </div>
                                    <div>
                                      <span className="font-medium">Last Order:</span> {formatDate(suggestion.lastOrderDate)}
                                    </div>
                                    <div>
                                      <span className="font-medium">Days Since:</span> {suggestion.daysSinceLastOrder}
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-500 mt-1">
                                    Ordered {suggestion.orderFrequency} times • Typical interval: {suggestion.typicalOrderInterval} days • Next suggested: {formatDate(suggestion.nextSuggestedOrderDate)}
                                  </div>
                                </div>
                              </div>

                              {selectedItems[vendorId]?.[suggestion.itemName] && (
                                <div className="flex items-center space-x-2">
                                  <Label className="text-sm">Qty:</Label>
                                  <Input
                                    type="number"
                                    value={selectedItems[vendorId][suggestion.itemName].quantity}
                                    onChange={(e) => handleQuantityChange(vendorId, suggestion.itemName, parseFloat(e.target.value) || 0)}
                                    className="w-20"
                                    min="0.01"
                                    step="0.01"
                                  />
                                  <span className="text-sm text-gray-600">
                                    = {formatCurrency(selectedItems[vendorId][suggestion.itemName].quantity * suggestion.avgUnitCost)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {error && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-red-600">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to analyze historical data: {error.message}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {suggestions && suggestions?.totalSuggestions === 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium mb-2">No order suggestions found for the selected criteria.</p>
                  {suggestions?.analysisStats?.invoicesAnalyzed === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm">No invoices found in the analysis period. Upload some supplier invoices first to get historical order suggestions.</p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <Link href="/invoices/upload">
                          <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Invoices
                          </Button>
                        </Link>
                        <Link href="/invoices">
                          <Button variant="outline">
                            <FileText className="h-4 w-4 mr-2" />
                            View All Invoices
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm mt-1">Try reducing the minimum order frequency or increasing the analysis period.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show guidance when no invoices exist at all */}
          {!suggestions && !error && !isLoading && invoiceCount === 0 && (
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
                  <p className="text-gray-600 mb-6">
                    Historical analysis requires supplier invoices to analyze past ordering patterns. 
                    Upload some invoices to get started with intelligent reorder suggestions.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/invoices/upload">
                      <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Your First Invoice
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => router.push('/ordering')}>
                      <Package className="h-4 w-4 mr-2" />
                      Return to Ordering Dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}