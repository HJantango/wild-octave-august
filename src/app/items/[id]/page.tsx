'use client';

import { use } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceHistory } from '@/components/items/price-history';
import { useItem } from '@/hooks/useItems';
import { formatCurrency, formatDate } from '@/lib/format';

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'House': 'bg-blue-100 text-blue-800',
    'Bulk': 'bg-purple-100 text-purple-800',
    'Fruit & Veg': 'bg-green-100 text-green-800',
    'Fridge & Freezer': 'bg-cyan-100 text-cyan-800',
    'Naturo': 'bg-emerald-100 text-emerald-800',
    'Groceries': 'bg-yellow-100 text-yellow-800',
    'Drinks Fridge': 'bg-indigo-100 text-indigo-800',
    'Supplements': 'bg-pink-100 text-pink-800',
    'Personal Care': 'bg-rose-100 text-rose-800',
    'Fresh Bread': 'bg-orange-100 text-orange-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

export default function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = use(params);
  const { data: item, isLoading, error } = useItem(id);

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Item Not Found</h2>
            <p className="text-gray-600 mb-4">The item you're looking for doesn't exist or has been deleted.</p>
            <Link href="/items">
              <Button>← Back to Items</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading || !item) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading item details...</p>
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
            <div className="flex items-center space-x-4 mb-2">
              <Link href="/items">
                <Button variant="ghost" size="sm">
                  ← Back to Items
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <div className="flex items-center space-x-3 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                {item.category}
              </span>
              {item.hasPriceChanged && (
                <Badge variant="warning">Price Changed</Badge>
              )}
            </div>
          </div>
          <div className="flex space-x-3">
            <Button variant="secondary">
              📝 Edit Item
            </Button>
            <Button variant="destructive">
              🗑️ Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Item Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Item Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="text-sm text-gray-900 mt-1">{item.name}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Category</dt>
                    <dd className="text-sm text-gray-900 mt-1">{item.category}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Vendor</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {item.vendor?.name || 'Not assigned'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Vendor Code</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {item.sku || 'Not set'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Barcode</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {item.barcode || 'Not set'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {formatDate(item.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <PriceHistory 
              priceHistory={item.priceHistory || []} 
              currentPrice={{
                costExGst: item.currentCostExGst,
                markup: item.currentMarkup,
                sellExGst: item.currentSellExGst,
                sellIncGst: item.currentSellIncGst,
              }}
            />
          </div>

          {/* Current Pricing */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Cost (ex GST)</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(item.currentCostExGst)}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Markup</div>
                  <div className="text-xl font-semibold text-blue-600">
                    {((item.currentMarkup - 1) * 100).toFixed(0)}%
                  </div>
                </div>

                <hr />

                <div>
                  <div className="text-sm text-gray-500 mb-1">Sell Price (ex GST)</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {formatCurrency(item.currentSellExGst)}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">GST (10%)</div>
                  <div className="text-lg text-gray-600">
                    {formatCurrency(item.currentSellIncGst - item.currentSellExGst)}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-700 mb-1">Final Price (inc GST)</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatCurrency(item.currentSellIncGst)}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Gross Margin</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {formatCurrency(item.currentSellExGst - item.currentCostExGst)}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({(((item.currentSellExGst - item.currentCostExGst) / item.currentSellExGst) * 100).toFixed(1)}%)
                  </div>
                </div>
              </CardContent>
            </Card>

            {item.lastPriceChange && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Price Change</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">Previous Cost</div>
                      <div className="text-lg font-medium text-gray-900">
                        {formatCurrency(item.lastPriceChange.previousCost)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500">Change</div>
                      <div className="flex items-center space-x-2">
                        {item.currentCostExGst > item.lastPriceChange.previousCost ? (
                          <Badge variant="warning">↗️ Increase</Badge>
                        ) : (
                          <Badge variant="success">↘️ Decrease</Badge>
                        )}
                        <span className="text-sm">
                          {(((item.currentCostExGst - item.lastPriceChange.previousCost) / item.lastPriceChange.previousCost) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500">Changed On</div>
                      <div className="text-sm text-gray-900">
                        {formatDate(item.lastPriceChange.changedAt)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}