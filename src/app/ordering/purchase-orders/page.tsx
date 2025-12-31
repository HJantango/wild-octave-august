'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendor: {
    id: string;
    name: string;
  };
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  subtotalExGst: number;
  gstAmount: number;
  shippingCost: number;
  totalIncGst: number;
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCostExGst: number;
  }>;
  linkedInvoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
  };
}

interface PurchaseOrdersResponse {
  purchaseOrders: PurchaseOrder[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function fetchPurchaseOrders({
  page = 1,
  limit = 20,
  status = '',
  search = '',
}: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<PurchaseOrdersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status }),
    ...(search && { search }),
  });

  const response = await fetch(`/api/purchase-orders?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch purchase orders');
  }
  return response.json();
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-purple-100 text-purple-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export default function PurchaseOrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page when searching
    }, 500);
    return () => clearTimeout(timer);
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['purchaseOrders', page, statusFilter, debouncedSearch],
    queryFn: () => fetchPurchaseOrders({
      page,
      status: statusFilter,
      search: debouncedSearch,
    }),
  });

  const handleStatusChange = (status: string) => {
    setStatusFilter(status === 'all' ? '' : status);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleDelete = async (orderId: string, orderNumber: string, status: string) => {
    // Enhanced confirmation for non-DRAFT orders
    let confirmMessage = `Are you sure you want to delete purchase order ${orderNumber}?`;

    if (status !== 'DRAFT') {
      confirmMessage = `⚠️ WARNING: This purchase order is ${status.replace(/_/g, ' ')}!\n\n` +
        `Deleting order: ${orderNumber}\n\n` +
        `This action CANNOT be undone and may affect:\n` +
        `- Vendor communications\n` +
        `- Linked invoices\n` +
        `- Inventory records\n\n` +
        `Are you ABSOLUTELY SURE you want to delete this order?`;
    } else {
      confirmMessage = `Are you sure you want to delete DRAFT purchase order ${orderNumber}?\n\nThis action cannot be undone.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    // Second confirmation for non-DRAFT orders
    if (status !== 'DRAFT') {
      if (!confirm(`FINAL CONFIRMATION: Delete ${orderNumber}?\n\nType your confirmation by clicking OK.`)) {
        return;
      }
    }

    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert(`Purchase order ${orderNumber} deleted successfully`);
        refetch();
      } else {
        const error = await response.json();
        alert(`Failed to delete purchase order: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      alert('Failed to delete purchase order');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600">Manage and track all purchase orders</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/ordering/purchase-orders/new">
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
                <span className="mr-2">➕</span>
                New Purchase Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search orders, vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="sm:w-48">
                <Select value={statusFilter || 'all'} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                    <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Purchase Orders</span>
              {data && (
                <span className="text-sm font-normal text-gray-500">
                  {data.pagination.totalCount} total orders
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
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </div>
                        <div className="h-8 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-red-600">
                  <span className="text-4xl mb-2 block">❌</span>
                  <p className="font-medium">Error loading purchase orders</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              </div>
            ) : data?.purchaseOrders && data.purchaseOrders.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {data.purchaseOrders.map((order) => (
                  <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <Link
                              href={`/ordering/purchase-orders/${order.id}`}
                              className="font-medium text-blue-600 hover:text-blue-700"
                            >
                              {order.orderNumber}
                            </Link>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-sm text-gray-600">{order.vendor.name}</span>
                              <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                                {order.status.replace('_', ' ')}
                              </Badge>
                              {order.linkedInvoice && (
                                <Badge variant="outline" className="text-xs">
                                  Linked to Invoice
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Order Date:</span>{' '}
                            {new Date(order.orderDate).toLocaleDateString()}
                          </div>
                          {order.expectedDeliveryDate && (
                            <div>
                              <span className="font-medium">Expected:</span>{' '}
                              {new Date(order.expectedDeliveryDate).toLocaleDateString()}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Items:</span>{' '}
                            {order.lineItems.length} line item{order.lineItems.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <p className="font-bold text-lg text-gray-900">
                          {formatCurrency(order.totalIncGst)}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Subtotal: {formatCurrency(order.subtotalExGst)}</p>
                          {order.shippingCost > 0 && (
                            <p>Shipping: {formatCurrency(order.shippingCost)}</p>
                          )}
                          <p>GST: {formatCurrency(order.gstAmount)}</p>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(order.id, order.orderNumber, order.status)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl mb-2 block">📝</span>
                <p className="font-medium">No purchase orders found</p>
                <p className="text-sm">
                  {statusFilter || searchQuery
                    ? 'Try adjusting your filters'
                    : 'Create your first purchase order to get started'
                  }
                </p>
                {!statusFilter && !searchQuery && (
                  <Link href="/ordering/purchase-orders/new" className="mt-4 inline-block">
                    <Button>Create Purchase Order</Button>
                  </Link>
                )}
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
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasNext}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}