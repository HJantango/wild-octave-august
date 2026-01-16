'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface InventoryItem {
  id: string;
  currentStock: number;
  minimumStock?: number;
  maximumStock?: number;
  reorderPoint?: number;
  packSize?: number;
  minimumOrderQuantity?: number;
  notes?: string;
  lastStockTake?: string;
  item: {
    id: string;
    name: string;
    category: string;
    currentCostExGst: number;
    vendor?: {
      id: string;
      name: string;
    };
  };
  stockMovements: Array<{
    id: string;
    movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reason?: string;
    createdAt: string;
  }>;
}

interface InventoryResponse {
  items: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function fetchInventory({
  page = 1,
  limit = 20,
  search = '',
  category = '',
  lowStock = false,
}: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
}): Promise<InventoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(category && { category }),
    ...(lowStock && { lowStock: 'true' }),
  });

  const response = await fetch(`/api/inventory?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch inventory');
  }
  return response.json();
}

async function adjustStock({
  inventoryItemId,
  quantity,
  movementType,
  reason,
  notes,
}: {
  inventoryItemId: string;
  quantity: number;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
  reason?: string;
  notes?: string;
}) {
  const response = await fetch(`/api/inventory/${inventoryItemId}/adjust-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quantity,
      movementType,
      reason,
      notes,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to adjust stock');
  }
  return response.json();
}

function StockAdjustmentModal({
  item,
  isOpen,
  onClose,
}: {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState<string>('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const queryClient = useQueryClient();

  const adjustStockMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
      setQuantity('');
      setReason('');
      setNotes('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !quantity) return;

    adjustStockMutation.mutate({
      inventoryItemId: item.id,
      quantity: parseFloat(quantity),
      movementType,
      reason,
      notes,
    });
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock: {item.item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current-stock">Current Stock</Label>
              <Input id="current-stock" value={item.currentStock} disabled />
            </div>
            <div>
              <Label htmlFor="movement-type">Type</Label>
              <Select value={movementType} onValueChange={(value: any) => setMovementType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Stock In</SelectItem>
                  <SelectItem value="OUT">Stock Out</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="quantity">
              {movementType === 'ADJUSTMENT' ? 'New Stock Level' : 'Quantity'}
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="waste">Waste/Spoilage</SelectItem>
                <SelectItem value="stock_take">Stock Take</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(
    searchParams.get('lowStock') === 'true'
  );
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Debounced search effect would go here

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', page, searchQuery, categoryFilter, lowStockFilter],
    queryFn: () => fetchInventory({
      page,
      search: searchQuery,
      category: categoryFilter,
      lowStock: lowStockFilter,
    }),
  });

  const getStockStatus = (item: InventoryItem) => {
    const { currentStock, minimumStock, reorderPoint } = item;
    const threshold = reorderPoint || minimumStock || 0;
    
    if (currentStock <= 0) {
      return { status: 'OUT_OF_STOCK', color: 'bg-red-100 text-red-800', label: 'Out of Stock' };
    } else if (currentStock <= threshold) {
      return { status: 'LOW_STOCK', color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' };
    } else {
      return { status: 'IN_STOCK', color: 'bg-green-100 text-green-800', label: 'In Stock' };
    }
  };

  const openAdjustModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsAdjustModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600">Track and manage your inventory levels</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <Select value={categoryFilter || 'all'} onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="House">House</SelectItem>
                    <SelectItem value="Bulk">Bulk</SelectItem>
                    <SelectItem value="Groceries">Groceries</SelectItem>
                    <SelectItem value="Supplements">Supplements</SelectItem>
                    <SelectItem value="Beverages">Beverages</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="low-stock"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="low-stock" className="text-sm">Low Stock Only</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Inventory Items</span>
              {data && (
                <span className="text-sm font-normal text-gray-500">
                  {data.pagination.totalCount} items
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        </div>
                        <div className="h-8 bg-gray-200 rounded w-24"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-red-600">
                  <span className="text-4xl mb-2 block">❌</span>
                  <p className="font-medium">Error loading inventory</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              </div>
            ) : data?.items && data.items.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {data.items.map((item) => {
                  const stockStatus = getStockStatus(item);
                  return (
                    <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{item.item.name}</h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                <span>{item.item.category}</span>
                                {item.item.vendor && (
                                  <span>• {item.item.vendor.name}</span>
                                )}
                                <Badge className={stockStatus.color}>
                                  {stockStatus.label}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-500">Current Stock:</span>
                              <span className="font-medium ml-2">{item.currentStock}</span>
                            </div>
                            {item.reorderPoint && (
                              <div>
                                <span className="text-gray-500">Reorder Point:</span>
                                <span className="font-medium ml-2">{item.reorderPoint}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Unit Cost:</span>
                              <span className="font-medium ml-2">{formatCurrency(item.item.currentCostExGst)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Stock Value:</span>
                              <span className="font-medium ml-2">
                                {formatCurrency(item.currentStock * item.item.currentCostExGst)}
                              </span>
                            </div>
                          </div>

                          {item.stockMovements.length > 0 && (
                            <div className="mt-3 text-xs text-gray-500">
                              Last movement: {item.stockMovements[0].movementType} {item.stockMovements[0].quantity} on{' '}
                              {new Date(item.stockMovements[0].createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          <Button
                            size="sm"
                            onClick={() => openAdjustModal(item)}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            Adjust Stock
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl mb-2 block">📦</span>
                <p className="font-medium">No inventory items found</p>
                <p className="text-sm">
                  {searchQuery || categoryFilter || lowStockFilter
                    ? 'Try adjusting your filters'
                    : 'Inventory items will appear as you process invoices'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalCount} total)
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasPrev}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasNext}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Adjustment Modal */}
        <StockAdjustmentModal
          item={selectedItem}
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}