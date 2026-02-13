'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { PrinterIcon, CheckCircleIcon, RefreshCwIcon } from 'lucide-react';

interface ShelfItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  categoryName: string;
}

interface ShelfGroup {
  shelfLabel: string;
  items: ShelfItem[];
  itemCount: number;
}

interface CheckedState {
  [itemId: string]: boolean;
}

const STORAGE_KEY = 'shelf-price-checker-state';

export default function ShelfPriceCheckerPage() {
  const [shelfGroups, setShelfGroups] = useState<ShelfGroup[]>([]);
  const [availableShelves, setAvailableShelves] = useState<string[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shelfFilter, setShelfFilter] = useState('all');
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});
  const [compactMode, setCompactMode] = useState(true);

  // Load checked state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCheckedItems(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved state:', e);
      }
    }
  }, []);

  // Save checked state to localStorage
  const saveCheckedState = useCallback((state: CheckedState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/shelf-price-checker?shelf=${encodeURIComponent(shelfFilter)}`);
      const result = await response.json();
      if (result.success) {
        setShelfGroups(result.data.shelfGroups);
        setAvailableShelves(result.data.availableShelves);
        setTotalItems(result.data.totalItems);
      } else {
        setError(result.error?.message || 'Failed to load data');
      }
    } catch (err) {
      setError('Failed to fetch shelf data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shelfFilter]);

  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => {
      const newState = { ...prev, [itemId]: !prev[itemId] };
      saveCheckedState(newState);
      return newState;
    });
  };

  const markAllChecked = (items: ShelfItem[]) => {
    setCheckedItems(prev => {
      const newState = { ...prev };
      items.forEach(item => {
        newState[item.id] = true;
      });
      saveCheckedState(newState);
      return newState;
    });
  };

  const clearAllChecked = () => {
    setCheckedItems({});
    localStorage.removeItem(STORAGE_KEY);
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate progress
  const allItems = shelfGroups.flatMap(g => g.items);
  const checkedCount = allItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading shelf data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 print:space-y-2">
        {/* Header - hide on print */}
        <div className="print:hidden">
          <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
            <div className="relative">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-1">🏷️ Shelf Price Checker</h1>
                  <p className="text-green-100">
                    Verify shelf labels match system prices • {totalItems} items
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="bg-white/20 rounded-full px-3 py-1 text-sm">
                      ✓ {checkedCount} / {totalItems} checked ({progressPercent}%)
                    </div>
                  </div>
                </div>
                <div className="mt-4 lg:mt-0 flex flex-wrap items-center gap-2">
                  <Select value={shelfFilter} onValueChange={setShelfFilter}>
                    <SelectTrigger className="w-48 bg-white/20 border-white/20 text-white">
                      <SelectValue placeholder="Select Shelf" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shelves</SelectItem>
                      {availableShelves.map((shelf) => (
                        <SelectItem key={shelf} value={shelf}>{shelf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={fetchData}
                    variant="outline"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    <RefreshCwIcon className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                  <Button 
                    onClick={handlePrint}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    <PrinterIcon className="w-4 h-4 mr-1" /> Print
                  </Button>
                  <Button 
                    onClick={clearAllChecked}
                    variant="outline"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    Reset All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">Shelf Price Checker — {shelfFilter === 'all' ? 'All Shelves' : shelfFilter}</h1>
          <p className="text-sm text-gray-600">Printed: {new Date().toLocaleDateString()} • {totalItems} items</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg print:hidden">
            {error}
          </div>
        )}

        {/* Compact Print Layout */}
        <div className="space-y-3 print:space-y-2">
          {shelfGroups.map((group) => {
            const groupChecked = group.items.filter(i => checkedItems[i.id]).length;
            const groupComplete = groupChecked === group.items.length;
            
            return (
              <Card key={group.shelfLabel} className={`print:break-inside-avoid print:shadow-none print:border ${groupComplete ? 'bg-green-50 print:bg-white' : ''}`}>
                <CardHeader className="py-2 px-3 print:py-1 print:px-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {groupComplete && <CheckCircleIcon className="w-4 h-4 text-green-600" />}
                      {group.shelfLabel}
                      <span className="font-normal text-gray-500">({groupChecked}/{group.itemCount})</span>
                    </CardTitle>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => markAllChecked(group.items)}
                      className="text-xs h-6 px-2 print:hidden"
                    >
                      Mark All ✓
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-1 px-3 print:py-0 print:px-2">
                  {/* Ultra-compact grid - 3 columns on desktop/print, 2 on mobile */}
                  <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                    {group.items.map((item) => (
                      <label
                        key={item.id}
                        className={`
                          flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer
                          hover:bg-gray-100 print:hover:bg-transparent
                          ${checkedItems[item.id] ? 'text-gray-400 line-through' : ''}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems[item.id] || false}
                          onChange={() => toggleItem(item.id)}
                          className="w-3 h-3 rounded print:w-2.5 print:h-2.5"
                        />
                        <span className="flex-1 truncate" title={item.name}>
                          {item.name}
                        </span>
                        <span className="font-mono text-gray-600 whitespace-nowrap">
                          {formatCurrency(item.price)}
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {shelfGroups.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <p>No items found for the selected shelf.</p>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { 
            font-size: 9pt !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
          nav, header, footer { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border { border: 1px solid #e5e7eb !important; }
          .print\\:space-y-2 > * + * { margin-top: 0.5rem !important; }
          .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
          .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .print\\:w-2\\.5 { width: 0.625rem !important; }
          .print\\:h-2\\.5 { height: 0.625rem !important; }
          .print\\:bg-white { background-color: white !important; }
          @page { margin: 0.5in; size: portrait; }
        }
      `}</style>
    </DashboardLayout>
  );
}
