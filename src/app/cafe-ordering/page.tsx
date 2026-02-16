'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  TruckIcon, 
  PackageIcon, 
  CalendarIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PrinterIcon
} from 'lucide-react';

interface CafeItem {
  id: string;
  itemName: string;
  variationName: string;
  displayName: string;
  vendor: string;
  vendorName: string;
  deliveryDays: number[];
  nextDelivery: string;
  daysUntilDelivery: number;
  totalQty: number;
  totalRevenue: number;
  avgPerDay: number;
  avgPerWeek: number;
  suggestedQty: number;
  byDayOfWeek: number[];
}

interface Vendor {
  id: string;
  name: string;
  deliveryDays: number[];
  nextDelivery: string;
  daysUntilDelivery: number;
  itemCount: number;
  totalQty: number;
  totalRevenue: number;
  avgPerDay: number;
  avgPerWeek: number;
  items: CafeItem[];
}

interface ApiResponse {
  success: boolean;
  data: {
    vendors: Vendor[];
    allItems: CafeItem[];
    summary: {
      totalItems: number;
      totalQtySold: number;
      totalRevenue: number;
    };
    period: {
      startDate: string;
      endDate: string;
      weeks: number;
      days: number;
    };
  };
}

interface StockEntry {
  [itemId: string]: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORAGE_KEY = 'cafe-ordering-stock-v2';

export default function CafeOrderingPage() {
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(6);
  const [currentStock, setCurrentStock] = useState<StockEntry>({});
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [buffer, setBuffer] = useState(20); // 20% default buffer

  // Load saved stock from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentStock(parsed.stock || {});
      } catch (e) {
        console.error('Failed to load saved stock:', e);
      }
    }
  }, []);

  // Save stock to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(currentStock).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        stock: currentStock, 
        savedAt: new Date().toISOString() 
      }));
    }
  }, [currentStock]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/cafe-ordering?weeks=${weeks}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }
      
      setData(result.data);
      
      // Initialize stock for new items
      setCurrentStock(prev => {
        const updated = { ...prev };
        result.data.allItems.forEach((item: CafeItem) => {
          if (!(item.id in updated)) {
            updated[item.id] = 0;
          }
        });
        return updated;
      });
      
      // Expand vendors with items needing orders
      const vendorsToExpand = new Set<string>();
      result.data.vendors.forEach((vendor: Vendor) => {
        const needsOrder = vendor.items.some((item: CafeItem) => {
          const stock = currentStock[item.id] || 0;
          const orderQty = calculateOrderQty(item, stock);
          return orderQty > 0;
        });
        if (needsOrder || vendor.daysUntilDelivery <= 2) {
          vendorsToExpand.add(vendor.id);
        }
      });
      setExpandedVendors(vendorsToExpand);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  // Calculate order quantity: (avgPerDay * daysUntilDelivery * buffer) - currentStock
  const calculateOrderQty = useCallback((item: CafeItem, stock: number): number => {
    const needed = Math.ceil(item.avgPerDay * item.daysUntilDelivery * (1 + buffer / 100));
    return Math.max(0, needed - stock);
  }, [buffer]);

  // Update stock for an item
  const updateStock = (itemId: string, value: number) => {
    setCurrentStock(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  // Toggle vendor expansion
  const toggleVendor = (vendorId: string) => {
    setExpandedVendors(prev => {
      const updated = new Set(prev);
      if (updated.has(vendorId)) {
        updated.delete(vendorId);
      } else {
        updated.add(vendorId);
      }
      return updated;
    });
  };

  // Get vendor priority based on delivery urgency
  const getVendorPriority = (vendor: Vendor): 'urgent' | 'soon' | 'normal' => {
    if (vendor.daysUntilDelivery <= 1) return 'urgent';
    if (vendor.daysUntilDelivery <= 2) return 'soon';
    return 'normal';
  };

  // Calculate totals for a vendor
  const getVendorOrderSummary = useCallback((vendor: Vendor) => {
    let itemsToOrder = 0;
    let totalUnits = 0;
    
    vendor.items.forEach(item => {
      const stock = currentStock[item.id] || 0;
      const orderQty = calculateOrderQty(item, stock);
      if (orderQty > 0) {
        itemsToOrder++;
        totalUnits += orderQty;
      }
    });
    
    return { itemsToOrder, totalUnits };
  }, [currentStock, calculateOrderQty]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  const todayName = DAYS[new Date().getDay()];

  return (
    <DashboardLayout>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4; margin: 1cm; }
            body { background: white !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .vendor-card { page-break-inside: avoid; margin-bottom: 10pt; }
            .print-header { display: block !important; text-align: center; margin-bottom: 15pt; }
            h1 { font-size: 18pt !important; }
            h2 { font-size: 14pt !important; }
            table { font-size: 10pt !important; }
            .bg-gradient-to-r { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          }
        `
      }} />

      <div className="space-y-6">
        {/* Print Header */}
        <div className="print-header hidden">
          <h1 className="text-2xl font-bold">Wild Octave Cafe Orders</h1>
          <p className="text-gray-600">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Header */}
        <div className="no-print relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-6 text-white">
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">☕ Cafe Ordering Dashboard</h1>
              <p className="text-orange-100">
                Calculate orders based on sales data • {todayName}
              </p>
              {data && (
                <p className="text-orange-200 text-sm mt-1">
                  📊 {data.period.weeks} weeks of data • {data.summary.totalItems} items • ${data.summary.totalRevenue.toLocaleString()} revenue
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value))}
                className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 text-sm"
              >
                <option value="4" className="text-gray-900">4 weeks</option>
                <option value="6" className="text-gray-900">6 weeks</option>
                <option value="8" className="text-gray-900">8 weeks</option>
                <option value="12" className="text-gray-900">12 weeks</option>
              </select>
              <Button 
                onClick={fetchData}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <RefreshCwIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh Data'}
              </Button>
              <Button 
                onClick={handlePrint}
                className="bg-white text-orange-600 hover:bg-orange-50"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Orders
              </Button>
            </div>
          </div>
        </div>

        {/* Buffer Setting */}
        <div className="no-print bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Safety Buffer:</label>
            <input
              type="range"
              min="0"
              max="50"
              value={buffer}
              onChange={(e) => setBuffer(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="text-sm font-semibold text-orange-600 min-w-[3rem]">{buffer}%</span>
            <span className="text-xs text-gray-500">
              (Order qty = avg sales × days until delivery × {(1 + buffer/100).toFixed(2)} − current stock)
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {data && (
          <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TruckIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vendors</p>
                    <p className="text-2xl font-bold">{data.vendors.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <PackageIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cafe Items</p>
                    <p className="text-2xl font-bold">{data.summary.totalItems}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Daily Sales</p>
                    <p className="text-2xl font-bold">{Math.round(data.summary.totalQtySold / data.period.days)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <AlertTriangleIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Need to Order</p>
                    <p className="text-2xl font-bold">
                      {data.vendors.reduce((sum, v) => sum + getVendorOrderSummary(v).itemsToOrder, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Vendor Cards */}
        {data && (
          <div className="space-y-4">
            {data.vendors.map(vendor => {
              const priority = getVendorPriority(vendor);
              const summary = getVendorOrderSummary(vendor);
              const isExpanded = expandedVendors.has(vendor.id);
              
              const priorityStyles = {
                urgent: 'border-red-300 bg-red-50',
                soon: 'border-orange-300 bg-orange-50',
                normal: 'border-gray-200 bg-white'
              };
              
              const priorityBadge = {
                urgent: <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium">Order Today!</span>,
                soon: <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full font-medium">Order Soon</span>,
                normal: null
              };

              return (
                <Card key={vendor.id} className={`vendor-card overflow-hidden border-2 ${priorityStyles[priority]}`}>
                  <CardHeader 
                    className="pb-2 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleVendor(vendor.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {vendor.name}
                            {priorityBadge[priority]}
                          </CardTitle>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-4 h-4" />
                              Next: {vendor.nextDelivery} ({vendor.daysUntilDelivery === 1 ? '1 day' : `${vendor.daysUntilDelivery} days`})
                            </span>
                            <span>•</span>
                            <span>{vendor.itemCount} items</span>
                            <span>•</span>
                            <span>Avg {vendor.avgPerDay.toFixed(1)}/day</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right no-print">
                        {summary.itemsToOrder > 0 ? (
                          <div className="flex items-center gap-2">
                            <AlertTriangleIcon className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="text-sm font-medium text-orange-600">
                                {summary.itemsToOrder} item{summary.itemsToOrder !== 1 ? 's' : ''} to order
                              </p>
                              <p className="text-xs text-gray-500">{summary.totalUnits} units total</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircleIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">Stock OK</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-600">
                              <th className="text-left py-2 px-2 font-medium">Item</th>
                              <th className="text-center py-2 px-2 font-medium w-20">Avg/Day</th>
                              <th className="text-center py-2 px-2 font-medium w-20">Days Until</th>
                              <th className="text-center py-2 px-2 font-medium w-20">Need</th>
                              <th className="text-center py-2 px-2 font-medium w-24 no-print">Current Stock</th>
                              <th className="text-center py-2 px-2 font-medium w-20 print-only hidden">Stock</th>
                              <th className="text-center py-2 px-2 font-medium w-24">Order Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendor.items.map((item, idx) => {
                              const stock = currentStock[item.id] || 0;
                              const needed = Math.ceil(item.avgPerDay * item.daysUntilDelivery * (1 + buffer / 100));
                              const orderQty = calculateOrderQty(item, stock);
                              
                              return (
                                <tr 
                                  key={item.id} 
                                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${orderQty > 0 ? 'bg-orange-50' : ''}`}
                                >
                                  <td className="py-2 px-2">
                                    <div>
                                      <span className="font-medium">{item.itemName}</span>
                                      {item.variationName && (
                                        <span className="text-gray-500 ml-1">- {item.variationName}</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {item.totalQty} sold / ${item.totalRevenue.toFixed(0)} revenue
                                    </div>
                                  </td>
                                  <td className="text-center py-2 px-2 font-medium">
                                    {item.avgPerDay.toFixed(1)}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    {item.daysUntilDelivery}
                                  </td>
                                  <td className="text-center py-2 px-2 text-gray-600">
                                    {needed}
                                  </td>
                                  <td className="text-center py-2 px-2 no-print">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stock}
                                      onChange={(e) => updateStock(item.id, parseInt(e.target.value) || 0)}
                                      className="w-20 h-8 text-center mx-auto"
                                    />
                                  </td>
                                  <td className="text-center py-2 px-2 print-only hidden">
                                    {stock}
                                  </td>
                                  <td className="text-center py-2 px-2">
                                    <span className={`font-bold text-lg ${orderQty > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                      {orderQty > 0 ? orderQty : '✓'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {summary.itemsToOrder > 0 && (
                            <tfoot>
                              <tr className="bg-orange-100 font-semibold">
                                <td className="py-2 px-2" colSpan={5}>Total to Order</td>
                                <td className="text-center py-2 px-2 text-orange-700 text-lg">
                                  {summary.totalUnits} units
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      
                      {/* Delivery Schedule */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Delivery days:</span>{' '}
                          {vendor.deliveryDays.length > 0 
                            ? vendor.deliveryDays.map(d => DAYS[d]).join(', ')
                            : 'As needed'}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Order Summary */}
        {data && (
          <Card className="border-2 border-orange-300 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg text-orange-900">📋 Quick Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.vendors
                  .map(vendor => ({ vendor, summary: getVendorOrderSummary(vendor) }))
                  .filter(({ summary }) => summary.itemsToOrder > 0)
                  .map(({ vendor, summary }) => (
                    <div key={vendor.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                      <div>
                        <span className="font-semibold text-gray-900">{vendor.name}</span>
                        <span className="text-gray-500 ml-2 text-sm">
                          (delivery {vendor.nextDelivery})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-orange-600 text-lg">{summary.totalUnits} units</span>
                        <span className="text-gray-500 text-sm ml-1">
                          ({summary.itemsToOrder} item{summary.itemsToOrder !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                  ))}
                {data.vendors.every(v => getVendorOrderSummary(v).itemsToOrder === 0) && (
                  <div className="text-center py-4 text-green-600 font-medium">
                    <CheckCircleIcon className="w-8 h-8 mx-auto mb-2" />
                    All stock levels are sufficient!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Print Footer */}
        <div className="print-only hidden text-center text-xs text-gray-500 mt-8 pt-4 border-t">
          Generated: {new Date().toLocaleString('en-AU')} | Buffer: {buffer}%
        </div>
      </div>
    </DashboardLayout>
  );
}
