'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

interface PrintItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  currentStock: number;
  currentSellIncGst: number;
  vendor?: { name: string } | null;
}

interface GroupedItems {
  [category: string]: PrintItem[];
}

export default function PrintPreviewPage() {
  const toast = useToast();
  const [items, setItems] = useState<GroupedItems>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrintView, setShowPrintView] = useState(false);

  useEffect(() => {
    loadVendors();
    loadItems();
  }, [selectedVendor]);

  const loadVendors = async () => {
    try {
      const response = await fetch('/api/vendors?limit=100');
      const data = await response.json();
      if (data.success) {
        setVendors(data.data.data);
      }
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedVendor) params.append('vendorId', selectedVendor);
      params.append('includeStock', 'true');

      const response = await fetch(`/api/items/print-sheet?${params}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.data.itemsByCategory);
        setCategories(data.data.categories);
      }
    } catch (error) {
      toast.error('Error', 'Failed to load items for print sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 100);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading print preview...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalItems = Object.values(items).reduce((sum, categoryItems) => sum + categoryItems.length, 0);
  const selectedVendorName = vendors.find(v => v.id === selectedVendor)?.name || 'All Vendors';

  return (
    <>
      {/* Screen View */}
      <DashboardLayout className={showPrintView ? 'hidden' : ''}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Print Preview - Stock Check</h1>
              <p className="text-gray-600">Preview and print organized stock check sheet</p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                Print Sheet
              </Button>
              <Link href="/items/organize">
                <Button variant="secondary">
                  Organize Items
                </Button>
              </Link>
              <Link href="/items">
                <Button variant="secondary">
                  Back to Items
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="vendor-select">Filter by Vendor</Label>
                <select
                  id="vendor-select"
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
                </div>
              </div>
              <div className="flex items-end">
                <div>
                  <p className="text-sm font-medium text-gray-700">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <PrintSheetContent
              items={items}
              categories={categories}
              vendorName={selectedVendorName}
            />
          </div>
        </div>
      </DashboardLayout>

      {/* Print View */}
      {showPrintView && (
        <div className="print-view">
          <PrintSheetContent
            items={items}
            categories={categories}
            vendorName={selectedVendorName}
          />
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-view,
          .print-view * {
            visibility: visible;
          }
          .print-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
        }
      `}</style>
    </>
  );
}

function PrintSheetContent({
  items,
  categories,
  vendorName,
}: {
  items: GroupedItems;
  categories: string[];
  vendorName: string;
}) {
  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="print-sheet">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">WILD OCTAVE ORGANICS - STOCK CHECK</h1>
        <p className="text-sm">
          <strong>Vendor:</strong> {vendorName} | <strong>Date:</strong> {today}
        </p>
      </div>

      {/* Items by Category */}
      {categories.map(category => {
        const categoryItems = items[category] || [];
        if (categoryItems.length === 0) return null;

        return (
          <div key={category} className="category-section mb-6">
            {/* Category Header */}
            <div className="category-header bg-blue-600 text-white px-3 py-2 font-bold text-lg mb-2 rounded">
              {category}
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="border border-gray-300 px-2 py-1 text-left w-1/3">Item</th>
                  <th className="border border-gray-300 px-2 py-1 text-left w-1/6">Shelf Location</th>
                  <th className="border border-gray-300 px-2 py-1 text-center w-20">Stock</th>
                  <th className="border border-gray-300 px-2 py-1 text-right w-20">Price</th>
                  <th className="border border-gray-300 px-2 py-1 text-center w-16">☐ Check</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {categoryItems.map(item => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="border border-gray-300 px-2 py-2">{item.name}</td>
                    <td className="border border-gray-300 px-2 py-2 text-gray-600">
                      {item.subcategory || '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold">
                      {item.currentStock}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right">
                      ${item.currentSellIncGst.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">☐</td>
                    <td className="border border-gray-300 px-2 py-2"></td>
                  </tr>
                ))}
                {/* Empty rows for handwritten additions */}
                {[...Array(3)].map((_, i) => (
                  <tr key={`empty-${category}-${i}`} className="border-b border-gray-200">
                    <td className="border border-gray-300 px-2 py-2 h-10"></td>
                    <td className="border border-gray-300 px-2 py-2"></td>
                    <td className="border border-gray-300 px-2 py-2"></td>
                    <td className="border border-gray-300 px-2 py-2"></td>
                    <td className="border border-gray-300 px-2 py-2 text-center">☐</td>
                    <td className="border border-gray-300 px-2 py-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t-2 border-gray-400">
        <div className="flex justify-between">
          <div>
            <strong>Checked By:</strong> _________________________
          </div>
          <div>
            <strong>Time:</strong> _________________________
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .category-header {
            background-color: #2563eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .category-section {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
