'use client';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemsFilters } from '@/components/items/items-filters';
import { ItemsTable } from '@/components/items/items-table';
import { Pagination } from '@/components/ui/pagination';
import { useItems, ItemsParams } from '@/hooks/useItems';
import { useToast } from '@/components/ui/toast';
import { LabelPrintingStatus, BulkPrintButton } from '@/components/ui/label-printing';
import { SquareCSVImport } from '@/components/items/square-csv-import';
import { MPLImport } from '@/components/items/mpl-import';
import Link from 'next/link';

export default function ItemsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState<Partial<ItemsParams>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const queryParams = useMemo(() => ({
    ...filters,
    page: currentPage,
    limit,
  }), [filters, currentPage]);

  const { data: itemsResponse, isLoading, error } = useItems(queryParams);

  const handleFiltersChange = (newFilters: Partial<ItemsParams>) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    toast.info('Coming Soon', 'CSV export functionality will be implemented in the next phase');
  };

  const items = itemsResponse?.data || [];
  const pagination = itemsResponse?.pagination;

  const stats = useMemo(() => {
    if (!items.length) return null;

    const totalItems = pagination?.total || 0;
    const priceChangedItems = items.filter(item => item.hasPriceChanged).length;
    const categories = [...new Set(items.map(item => item.category))].length;

    return {
      totalItems,
      priceChangedItems,
      categories,
    };
  }, [items, pagination]);

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Items</h2>
            <p className="text-gray-600">Unable to load items. Please try again later.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Item Management</h1>
            <p className="text-gray-600">Manage your inventory with price history tracking</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/orders">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                📋 Order Form (6-Week Analysis)
              </Button>
            </Link>
            <Link href="/items/organize">
              <Button variant="secondary" className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200">
                📊 Organize Items
              </Button>
            </Link>
            <Link href="/items/print-preview">
              <Button variant="secondary" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                🖨️ Print Stock Check
              </Button>
            </Link>
            <BulkPrintButton
              items={items}
              variant="secondary"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              🏷️ Print Labels
            </BulkPrintButton>
            <Button variant="secondary" onClick={handleExportCSV}>
              📤 Export CSV
            </Button>
            <Button>
              ➕ Add Item
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">📦</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalItems.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600">📈</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Price Changes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.priceChangedItems}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600">🏷️</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Categories</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.categories}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <LabelPrintingStatus compact={false} />
          </div>
        )}

        {/* MPL Import (Cost + Inventory Data) */}
        <MPLImport onImportComplete={() => {
          // Reload items after import
          setCurrentPage(1);
          setFilters({});
        }} />

        {/* Square CSV Import (Sales Data) */}
        <SquareCSVImport onImportComplete={() => {
          // Reload items after import
          setCurrentPage(1);
          setFilters({});
        }} />

        {/* Filters */}
        <ItemsFilters
          onFiltersChange={handleFiltersChange}
          loading={isLoading}
        />

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Items</span>
              {pagination && (
                <span className="text-sm font-normal text-gray-500">
                  Showing {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, pagination.total)} of {pagination.total}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ItemsTable items={items} loading={isLoading} />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
                onPageChange={handlePageChange}
                loading={isLoading}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}