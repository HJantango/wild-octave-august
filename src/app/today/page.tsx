'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  TruckIcon, 
  PackageIcon, 
  ClipboardListIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  ChevronRightIcon,
  CalendarIcon,
  FileTextIcon,
  ShoppingCartIcon
} from 'lucide-react';

interface VendorOrder {
  id: string;
  name: string;
  itemCount: number;
  totalUnits: number;
  estimatedValue: number;
  daysUntilDelivery: number;
  nextDelivery: string;
  orderDeadline?: string;
  priority: 'urgent' | 'today' | 'soon' | 'normal';
}

interface DeliveryExpected {
  id: string;
  vendorName: string;
  orderDate?: string;
  status: 'expected' | 'arrived' | 'late';
}

interface InvoicePending {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  name: string;
  vendorName?: string;
  currentStock: number;
  reorderPoint: number;
  avgDaily?: number;
  daysLeft?: number;
}

interface PieOrder {
  variation: string;
  avgPerDay: number;
  suggestedQty: number;
  boxesNeeded: number;
}

interface TodayData {
  ordersNeeded: VendorOrder[];
  pieOrders: PieOrder[];
  pieOrderDay: boolean; // Is today a pie order day?
  deliveriesExpected: DeliveryExpected[];
  invoicesPending: InvoicePending[];
  lowStock: LowStockItem[];
  summary: {
    ordersToPlace: number;
    pieBoxes: number;
    deliveriesToday: number;
    invoicesToProcess: number;
    lowStockCount: number;
  };
}

// Track which vendors have been marked as ordered (localStorage)
const ORDERED_STORAGE_KEY = 'today-orders-placed';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderedVendors, setOrderedVendors] = useState<Set<string>>(new Set());

  // Load ordered status from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(ORDERED_STORAGE_KEY);
    if (saved) {
      try {
        const { date, vendors } = JSON.parse(saved);
        // Only use if it's from today
        const today = new Date().toISOString().split('T')[0];
        if (date === today && Array.isArray(vendors)) {
          setOrderedVendors(new Set(vendors));
        }
      } catch (e) {
        console.error('Failed to load ordered status:', e);
      }
    }
  }, []);

  // Mark vendor as ordered
  const markAsOrdered = (vendorId: string) => {
    const updated = new Set(orderedVendors);
    updated.add(vendorId);
    setOrderedVendors(updated);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(ORDERED_STORAGE_KEY, JSON.stringify({
      date: today,
      vendors: Array.from(updated),
    }));
  };

  // Unmark vendor
  const unmarkOrdered = (vendorId: string) => {
    const updated = new Set(orderedVendors);
    updated.delete(vendorId);
    setOrderedVendors(updated);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(ORDERED_STORAGE_KEY, JSON.stringify({
      date: today,
      vendors: Array.from(updated),
    }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current month for calendar
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const todayDay = now.getDay(); // 0=Sun, 1=Mon, etc.
      
      // Pie order days: Monday (1) and Wednesday (3)
      const isPieOrderDay = todayDay === 1 || todayDay === 3;

      // Fetch all data in parallel
      const [cafeResponse, dashboardResponse, invoicesResponse, pieResponse, calendarResponse] = await Promise.all([
        fetch('/api/cafe-ordering?weeks=6'),
        fetch('/api/dashboard'),
        fetch('/api/invoices?status=RECEIVED&limit=10'),
        fetch('/api/square/pie-analysis'),
        fetch(`/api/calendar/orders?month=${month}`),
      ]);

      const [cafeData, dashboardData, invoicesData, pieData, calendarData] = await Promise.all([
        cafeResponse.json(),
        dashboardResponse.json(),
        invoicesResponse.json(),
        pieResponse.json().catch(() => ({ success: false })),
        calendarResponse.json().catch(() => ({ success: false })),
      ]);

      // Process cafe ordering data into vendor orders
      const ordersNeeded: VendorOrder[] = [];
      if (cafeData.success && cafeData.data?.vendors) {
        for (const vendor of cafeData.data.vendors) {
          if (vendor.id === 'unassigned') continue;
          
          // Calculate items needing orders (simplified - would need stock data)
          const itemsNeedingOrder = vendor.items.filter((item: any) => item.suggestedQty > 0);
          
          if (vendor.daysUntilDelivery <= 3 || itemsNeedingOrder.length > 0) {
            let priority: 'urgent' | 'today' | 'soon' | 'normal' = 'normal';
            if (vendor.daysUntilDelivery <= 1) priority = 'urgent';
            else if (vendor.daysUntilDelivery <= 2) priority = 'today';
            else if (vendor.daysUntilDelivery <= 3) priority = 'soon';

            ordersNeeded.push({
              id: vendor.id,
              name: vendor.name,
              itemCount: itemsNeedingOrder.length,
              totalUnits: itemsNeedingOrder.reduce((sum: number, i: any) => sum + i.suggestedQty, 0),
              estimatedValue: vendor.totalRevenue / 6, // Rough weekly estimate
              daysUntilDelivery: vendor.daysUntilDelivery,
              nextDelivery: vendor.nextDelivery,
              priority,
            });
          }
        }
      }

      // Sort by priority
      const priorityOrder = { urgent: 0, today: 1, soon: 2, normal: 3 };
      ordersNeeded.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Process pie orders if it's a pie day
      const pieOrders: PieOrder[] = [];
      let totalPieBoxes = 0;
      if (isPieOrderDay && pieData.success && pieData.data?.variations) {
        for (const v of pieData.data.variations) {
          if (v.boxesNeeded > 0) {
            pieOrders.push({
              variation: v.name || v.variation || 'Unknown',
              avgPerDay: v.avgPerDay || 0,
              suggestedQty: v.suggestedQty || 0,
              boxesNeeded: v.boxesNeeded || 0,
            });
            totalPieBoxes += v.boxesNeeded;
          }
        }
      }

      // Get deliveries expected today (from calendar)
      const deliveriesExpected: DeliveryExpected[] = [];
      if (calendarData.success && calendarData.data?.orders) {
        const todayStr = new Date().toISOString().split('T')[0];
        for (const order of calendarData.data.orders) {
          const deliveryDate = order.deliveryDate?.split('T')[0];
          if (deliveryDate === todayStr) {
            deliveriesExpected.push({
              id: order.id,
              vendorName: order.vendor?.name || order.vendorName || 'Unknown',
              orderDate: order.scheduleDate,
              status: order.status === 'delivered' ? 'arrived' : 'expected',
            });
          }
        }
      }

      // Get pending invoices
      const invoicesPending: InvoicePending[] = [];
      if (invoicesData.success && invoicesData.data?.invoices) {
        for (const inv of invoicesData.data.invoices) {
          invoicesPending.push({
            id: inv.id,
            vendorName: inv.vendor?.name || 'Unknown',
            invoiceNumber: inv.invoiceNumber || 'N/A',
            total: inv.totalIncGst || 0,
            status: inv.status,
            createdAt: inv.createdAt,
          });
        }
      }

      // Get low stock items
      const lowStock: LowStockItem[] = [];
      if (dashboardData.success && dashboardData.data?.inventory?.lowStock) {
        for (const item of dashboardData.data.inventory.lowStock) {
          lowStock.push({
            id: item.id,
            name: item.name,
            vendorName: item.vendorName,
            currentStock: item.currentStock,
            reorderPoint: item.reorderPoint,
          });
        }
      }

      setData({
        ordersNeeded,
        pieOrders,
        pieOrderDay: isPieOrderDay,
        deliveriesExpected,
        invoicesPending,
        lowStock,
        summary: {
          ordersToPlace: ordersNeeded.filter(o => o.priority === 'urgent' || o.priority === 'today').length,
          pieBoxes: totalPieBoxes,
          deliveriesToday: deliveriesExpected.filter(d => d.status === 'expected').length,
          invoicesToProcess: invoicesPending.length,
          lowStockCount: lowStock.length,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date();
  const dayName = DAYS[today.getDay()];
  const dateStr = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 border-red-300 text-red-900';
      case 'today': return 'bg-orange-50 border-orange-300 text-orange-900';
      case 'soon': return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      default: return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium">ORDER NOW</span>;
      case 'today': return <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full font-medium">Order Today</span>;
      case 'soon': return <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full font-medium">Order Soon</span>;
      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">📋 Today's Actions</h1>
              <p className="text-blue-100 text-lg">
                {dayName}, {dateStr}
              </p>
            </div>
            <Button 
              variant="ghost"
              onClick={fetchData}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <RefreshCwIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className={data.summary.ordersToPlace > 0 ? 'border-2 border-orange-300 bg-orange-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.summary.ordersToPlace > 0 ? 'bg-orange-200' : 'bg-blue-100'}`}>
                    <ShoppingCartIcon className={`w-5 h-5 ${data.summary.ordersToPlace > 0 ? 'text-orange-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cafe Orders</p>
                    <p className="text-2xl font-bold">{data.summary.ordersToPlace}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pie Orders - only show on pie days */}
            <Card className={data.pieOrderDay && data.summary.pieBoxes > 0 ? 'border-2 border-pink-300 bg-pink-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.pieOrderDay ? 'bg-pink-200' : 'bg-gray-100'}`}>
                    <span className="text-xl">🥧</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pie Boxes</p>
                    <p className="text-2xl font-bold">
                      {data.pieOrderDay ? data.summary.pieBoxes : '-'}
                    </p>
                    {!data.pieOrderDay && <p className="text-xs text-gray-400">Not a pie day</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TruckIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Deliveries Today</p>
                    <p className="text-2xl font-bold">{data.summary.deliveriesToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={data.summary.invoicesToProcess > 0 ? 'border-2 border-blue-300 bg-blue-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.summary.invoicesToProcess > 0 ? 'bg-blue-200' : 'bg-purple-100'}`}>
                    <FileTextIcon className={`w-5 h-5 ${data.summary.invoicesToProcess > 0 ? 'text-blue-600' : 'text-purple-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Invoices to Process</p>
                    <p className="text-2xl font-bold">{data.summary.invoicesToProcess}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={data.summary.lowStockCount > 0 ? 'border-2 border-red-300 bg-red-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.summary.lowStockCount > 0 ? 'bg-red-200' : 'bg-gray-100'}`}>
                    <AlertTriangleIcon className={`w-5 h-5 ${data.summary.lowStockCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Low Stock Items</p>
                    <p className="text-2xl font-bold">{data.summary.lowStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders Needed */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCartIcon className="w-5 h-5 text-orange-600" />
                      Orders Needed
                    </CardTitle>
                    <CardDescription>Vendors requiring orders based on delivery schedule</CardDescription>
                  </div>
                  <Link href="/cafe-ordering">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {data.ordersNeeded.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All orders up to date!</p>
                    <p className="text-sm">No urgent orders needed right now.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.ordersNeeded.map(vendor => {
                      const isOrdered = orderedVendors.has(vendor.id);
                      return (
                        <div 
                          key={vendor.id}
                          className={`p-4 rounded-lg border-2 ${isOrdered ? 'bg-green-50 border-green-300' : getPriorityStyles(vendor.priority)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {isOrdered && <CheckCircleIcon className="w-5 h-5 text-green-600" />}
                                <span className={`font-semibold ${isOrdered ? 'text-green-800' : ''}`}>{vendor.name}</span>
                                {!isOrdered && getPriorityBadge(vendor.priority)}
                                {isOrdered && <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">Ordered ✓</span>}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                <span>{vendor.itemCount} items</span>
                                <span className="mx-2">•</span>
                                <span>~{vendor.totalUnits} units</span>
                                <span className="mx-2">•</span>
                                <span>Delivery: {vendor.nextDelivery}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOrdered ? (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => unmarkOrdered(vendor.id)}
                                  className="text-gray-600"
                                >
                                  Undo
                                </Button>
                              ) : (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => markAsOrdered(vendor.id)}
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                                    Done
                                  </Button>
                                  <Link href={`/cafe-ordering`}>
                                    <Button size="sm" variant={vendor.priority === 'urgent' ? 'destructive' : 'default'}>
                                      Order
                                      <ChevronRightIcon className="w-4 h-4 ml-1" />
                                    </Button>
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Orders - only show on pie days */}
            {data.pieOrderDay && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">🥧</span>
                        Pie Orders
                      </CardTitle>
                      <CardDescription>
                        {new Date().getDay() === 1 ? 'Monday order → Tuesday delivery' : 'Wednesday order → Thursday delivery'}
                      </CardDescription>
                    </div>
                    <Link href="/orders/pie-calculator">
                      <Button variant="outline" size="sm">Calculator</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {data.pieOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p className="font-medium">Pies stocked!</p>
                      <p className="text-sm">No pie orders needed based on current stock.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.pieOrders.map((pie, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-pink-50 border border-pink-200"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{pie.variation}</span>
                            <div className="text-xs text-gray-500">
                              Avg {pie.avgPerDay.toFixed(1)}/day
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-pink-600 text-lg">{pie.boxesNeeded}</span>
                            <span className="text-gray-500 text-sm ml-1">boxes</span>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t border-pink-200 flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total Boxes</span>
                        <span className="font-bold text-pink-700 text-xl">{data.summary.pieBoxes}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => markAsOrdered('pies-alive')}
                          className={orderedVendors.has('pies-alive') ? 'bg-green-50 text-green-700 border-green-300' : 'text-green-600 border-green-300 hover:bg-green-50'}
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          {orderedVendors.has('pies-alive') ? 'Ordered ✓' : 'Mark Ordered'}
                        </Button>
                        <Link href="/orders/pie-calculator" className="flex-1">
                          <Button size="sm" className="w-full bg-pink-600 hover:bg-pink-700">
                            Open Calculator
                            <ChevronRightIcon className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoices to Process */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileTextIcon className="w-5 h-5 text-blue-600" />
                      Invoices to Process
                    </CardTitle>
                    <CardDescription>Received invoices awaiting processing</CardDescription>
                  </div>
                  <Link href="/invoices">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {data.invoicesPending.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No invoices waiting to be processed.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.invoicesPending.map(invoice => (
                      <Link 
                        key={invoice.id}
                        href={`/invoices/${invoice.id}`}
                        className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold">{invoice.vendorName}</span>
                            <div className="text-sm text-gray-600 mt-1">
                              #{invoice.invoiceNumber}
                              <span className="mx-2">•</span>
                              ${invoice.total.toFixed(2)}
                            </div>
                          </div>
                          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low Stock Alerts */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangleIcon className="w-5 h-5 text-red-600" />
                      Low Stock Alerts
                    </CardTitle>
                    <CardDescription>Items below reorder point</CardDescription>
                  </div>
                  <Link href="/ordering/inventory">
                    <Button variant="outline" size="sm">View Inventory</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {data.lowStock.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">Stock levels healthy!</p>
                    <p className="text-sm">All items above reorder points.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.lowStock.slice(0, 8).map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200"
                      >
                        <div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {item.vendorName && (
                            <span className="text-sm text-gray-500 ml-2">({item.vendorName})</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-red-600">{item.currentStock}</span>
                          <span className="text-gray-500 text-sm"> / {item.reorderPoint}</span>
                        </div>
                      </div>
                    ))}
                    {data.lowStock.length > 8 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        +{data.lowStock.length - 8} more items
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deliveries Expected */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TruckIcon className="w-5 h-5 text-green-600" />
                      Deliveries Expected
                    </CardTitle>
                    <CardDescription>Arriving today</CardDescription>
                  </div>
                  <Link href="/ordering/calendar">
                    <Button variant="outline" size="sm">Calendar</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {data.deliveriesExpected.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TruckIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">No deliveries today</p>
                    <p className="text-sm">Check the calendar for upcoming orders.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.deliveriesExpected.map(delivery => (
                      <div 
                        key={delivery.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          delivery.status === 'arrived' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {delivery.status === 'arrived' ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                          ) : (
                            <ClockIcon className="w-5 h-5 text-yellow-600" />
                          )}
                          <span className="font-medium text-gray-900">{delivery.vendorName}</span>
                        </div>
                        <span className={`text-sm font-medium ${
                          delivery.status === 'arrived' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {delivery.status === 'arrived' ? 'Delivered ✓' : 'Expected'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardListIcon className="w-5 h-5 text-purple-600" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common daily tasks</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/orders/pie-calculator">
                    <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">🥧</span>
                      <span className="text-sm">Pie Orders</span>
                    </Button>
                  </Link>
                  <Link href="/cafe-ordering">
                    <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">☕</span>
                      <span className="text-sm">Cafe Orders</span>
                    </Button>
                  </Link>
                  <Link href="/invoices/upload">
                    <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">📤</span>
                      <span className="text-sm">Upload Invoice</span>
                    </Button>
                  </Link>
                  <Link href="/shop-diary">
                    <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">📔</span>
                      <span className="text-sm">Shop Diary</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
