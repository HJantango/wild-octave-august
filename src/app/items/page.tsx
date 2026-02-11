'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  EditIcon
} from 'lucide-react';

interface Item {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  vendor?: {
    id: string;
    name: string;
  };
  currentCostExGst: number;
  currentMarkup: number;
  currentSellExGst: number;
  currentSellIncGst: number;
  inventoryItem?: {
    currentStock: number;
    minimumStock?: number;
    maximumStock?: number;
  };
  hasPriceChanged?: boolean;
  lastPriceChange?: {
    previousCost: number;
    changedAt: string;
  };
}

interface ItemFilters {
  category: string;
  vendorId: string;
  search: string;
  priceChanged: string;
}

const CATEGORIES = [
  'House',
  'Bulk',
  'Groceries',
  'Supplements',
  'Bodycare',
  'Chilled',
  'Frozen',
  'Cafe',
  'Other'
];

export default function ItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filters, setFilters] = useState<ItemFilters>({
    category: 'all',
    vendorId: 'all',
    search: '',
    priceChanged: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Load last sync time from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('catalogLastSyncTime');
    if (saved) {
      setLastSyncTime(saved);
    }
  }, []);

  const handleSyncCatalog = async () => {
    setSyncingCatalog(true);
    setSyncStatus(null);
    try {
      const response = await fetch('/api/square/catalog-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      
      if (result.success || result.data) {
        const summary = result.data?.summary || result.summary;
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem('catalogLastSyncTime', now);
        setSyncStatus({
          type: 'success',
          message: `✓ Synced: ${summary?.updated || 0} updated, ${summary?.created || 0} created, ${summary?.skipped || 0} skipped`
        });
        toast.success(
          'Catalog Synced',
          `Updated: ${summary?.updated || 0}, Created: ${summary?.created || 0}, Skipped: ${summary?.skipped || 0}`
        );
        // Reload items to show updates
        loadItems();
      } else {
        throw new Error(result.error?.message || 'Sync failed');
      }
    } catch (error: any) {
      setSyncStatus({
        type: 'error',
        message: `✗ Sync failed: ${error.message || 'Unknown error'}`
      });
      toast.error('Sync Failed', error.message || 'Failed to sync catalog from Square');
    } finally {
      setSyncingCatalog(false);
    }
  };

  const loadVendors = useCallback(async () => {
    try {
      const response = await fetch('/api/vendors');
      const result = await response.json();
      if (result.success) {
        setVendors(result.data || []);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      // Add filters to params
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters.vendorId && filters.vendorId !== 'all') params.append('vendorId', filters.vendorId);
      if (filters.search) params.append('search', filters.search);
      if (filters.priceChanged && filters.priceChanged !== 'all') {
        params.append('priceChanged', filters.priceChanged);
      }

      const response = await fetch(`/api/items?${params}`);
      const result = await response.json();

      if (result.success) {
        setItems(result.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.data.pagination.total,
          totalPages: result.data.pagination.totalPages,
        }));
      } else {
        console.error('Failed to load items:', result);
        toast.error('Load Failed', 'Failed to load items');
      }
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Error', 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, toast]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleFilterChange = (key: keyof ItemFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      category: 'all',
      vendorId: 'all',
      search: '',
      priceChanged: 'all',
    });
  };

  const getStockStatus = (item: Item) => {
    if (!item.inventoryItem) return null;

    const { currentStock, minimumStock } = item.inventoryItem;

    if (minimumStock && currentStock <= minimumStock) {
      return { icon: AlertTriangleIcon, color: 'text-red-600', label: 'Low Stock' };
    }

    return { icon: CheckCircleIcon, color: 'text-green-600', label: 'In Stock' };
  };

  const calculateMargin = (item: Item) => {
    // Convert to numbers in case they're Decimal objects
    const sellPrice = Number(item.currentSellExGst);
    const costPrice = Number(item.currentCostExGst);
    const margin = sellPrice - costPrice;
    const marginPercent = (margin / costPrice) * 100;
    return { margin, marginPercent };
  };

  if (loading && items.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Item Management</h1>
                <p className="text-purple-100 text-lg">
                  Manage your product catalog with pricing and inventory tracking
                </p>
                <p className="text-purple-200 text-sm mt-1">
                  {pagination.total} items • {items.filter(i => i.hasPriceChanged).length} price changes
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleSyncCatalog}
                    disabled={syncingCatalog}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm"
                  >
                    {syncingCatalog ? (
                      <>
                        <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync from Square
                      </>
                    )}
                  </Button>
                  <Link href="/items/new">
                    <Button className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm px-6 py-3 text-lg font-semibold">
                      <PlusIcon className="w-5 h-5 mr-2" />
                      Add Item
                    </Button>
                  </Link>
                </div>
                {/* Last sync time and status */}
                <div className="text-right text-sm">
                  {lastSyncTime && (
                    <div className="text-purple-200">
                      Last synced: {new Date(lastSyncTime).toLocaleString('en-AU', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                  {syncStatus && (
                    <div className={syncStatus.type === 'success' ? 'text-green-300' : 'text-red-300'}>
                      {syncStatus.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Total Items</p>
                  <p className="text-3xl font-bold">{pagination.total}</p>
                  <p className="text-sm opacity-75 mt-1">In catalog</p>
                </div>
                <PackageIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Low Stock</p>
                  <p className="text-3xl font-bold">
                    {items.filter(i => i.inventoryItem && i.inventoryItem.minimumStock && i.inventoryItem.currentStock <= i.inventoryItem.minimumStock).length}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Need reorder</p>
                </div>
                <AlertTriangleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Price Changes</p>
                  <p className="text-3xl font-bold">
                    {items.filter(i => i.hasPriceChanged).length}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Recent updates</p>
                </div>
                <TrendingUpIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Categories</p>
                  <p className="text-3xl font-bold">
                    {new Set(items.map(i => i.category)).size}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Product types</p>
                </div>
                <FilterIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FilterIcon className="w-5 h-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <Select value={filters.vendorId} onValueChange={(value) => handleFilterChange('vendorId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All vendors</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Changed</label>
                <Select value={filters.priceChanged} onValueChange={(value) => handleFilterChange('priceChanged', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All items</SelectItem>
                    <SelectItem value="true">Price changed</SelectItem>
                    <SelectItem value="false">No price change</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Name, SKU, barcode..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle>Items Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12">
                <PackageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No items found</h3>
                <p className="text-gray-600 mb-4">
                  {filters.search || filters.category !== 'all' || filters.vendorId !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first item'}
                </p>
                {!filters.search && filters.category === 'all' && filters.vendorId === 'all' && (
                  <Link href="/items/new">
                    <Button>
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pricing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => {
                      const stockStatus = getStockStatus(item);
                      const { marginPercent } = calculateMargin(item);

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {item.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center space-x-2">
                              {item.sku && <span>SKU: {item.sku}</span>}
                              {item.hasPriceChanged && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                  <TrendingUpIcon className="w-3 h-3 mr-1" />
                                  Price changed
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {item.vendor?.name || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className="bg-blue-100 text-blue-800">
                              {item.category}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {formatCurrency(item.currentSellIncGst)}
                              </div>
                              <div className="text-gray-500">
                                Cost: {formatCurrency(item.currentCostExGst)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {marginPercent.toFixed(1)}%
                              </div>
                              <div className="text-gray-500 text-xs">
                                {Number(item.currentMarkup).toFixed(2)}x markup
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.inventoryItem ? (
                              <div className="flex items-center space-x-2">
                                {stockStatus && (
                                  <stockStatus.icon className={`w-4 h-4 ${stockStatus.color}`} />
                                )}
                                <span className="text-sm text-gray-900">
                                  {item.inventoryItem.currentStock}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/items/${item.id}`}>
                              <Button variant="ghost" size="sm">
                                <EditIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
