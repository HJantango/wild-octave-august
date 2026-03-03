'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';

// Types
interface CafeItem {
  id: string;
  name: string;
  variationId: string;
  variationName: string;
  vendorId: string;
  vendorName: string;
  totalSold: number;
  avgPerDay: number;
  avgPerWeek: number;
  categoryName: string;
}

interface VendorSchedule {
  id: string;
  name: string;
  orderDay: string;
  orderTime?: string;
  deliveryDay: string;
  deliveryTime?: string;
  coversDays: string[];
  frequency: 'weekly' | 'fortnightly' | 'when-needed';
  whenNeededThreshold?: number;
  color: string;
  icon: string;
}

interface StockEntry {
  [itemId: string]: number;
}

interface AnalysisResult {
  items: CafeItem[];
  totalItemsSold: number;
  totalDays: number;
  dateRange: { start: string; end: string };
  vendors: string[];
}

// Default vendor schedules
const DEFAULT_VENDOR_SCHEDULES: VendorSchedule[] = [
  {
    id: 'yummify',
    name: 'Yummify',
    orderDay: 'Sunday',
    deliveryDay: 'Tuesday',
    deliveryTime: '2:00 PM',
    coversDays: ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'monday'],
    frequency: 'weekly',
    color: 'pink',
    icon: '🧁',
  },
  {
    id: 'liz-jackson',
    name: 'Liz Jackson',
    orderDay: 'Thursday',
    deliveryDay: 'Friday',
    coversDays: ['friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    frequency: 'weekly',
    color: 'purple',
    icon: '🎂',
  },
  {
    id: 'breadicine',
    name: 'Breadicine',
    orderDay: 'Friday',
    orderTime: '12:00 PM',
    deliveryDay: 'Monday',
    coversDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    frequency: 'weekly',
    color: 'amber',
    icon: '🥖',
  },
  {
    id: 'love-bites',
    name: 'Love Bites',
    orderDay: 'When Needed',
    deliveryDay: 'TBD',
    coversDays: [],
    frequency: 'when-needed',
    whenNeededThreshold: 12,
    color: 'rose',
    icon: '💕',
  },
  {
    id: 'byron-bay-brownies',
    name: 'Byron Bay Brownies',
    orderDay: 'Friday',
    deliveryDay: 'Friday',
    coversDays: ['friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    frequency: 'fortnightly',
    color: 'amber',
    icon: '🍫',
  },
  {
    id: 'wild-octave-organics',
    name: 'Wild Octave Organics',
    orderDay: 'In-House',
    deliveryDay: 'Daily',
    coversDays: [],
    frequency: 'weekly',
    color: 'green',
    icon: '🌿',
  },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; light: string }> = {
  pink: { bg: 'bg-pink-500', border: 'border-pink-300', text: 'text-pink-700', light: 'bg-pink-50' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700', light: 'bg-purple-50' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-300', text: 'text-amber-700', light: 'bg-amber-50' },
  rose: { bg: 'bg-rose-500', border: 'border-rose-300', text: 'text-rose-700', light: 'bg-rose-50' },
  green: { bg: 'bg-green-500', border: 'border-green-300', text: 'text-green-700', light: 'bg-green-50' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700', light: 'bg-blue-50' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700', light: 'bg-indigo-50' },
  teal: { bg: 'bg-teal-500', border: 'border-teal-300', text: 'text-teal-700', light: 'bg-teal-50' },
};

export default function CafeCalculatorPage() {
  // State
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [squareWeeks, setSquareWeeks] = useState(6);
  const [currentStock, setCurrentStock] = useState<StockEntry>({});
  const [vendorSchedules, setVendorSchedules] = useState<VendorSchedule[]>(DEFAULT_VENDOR_SCHEDULES);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [activeVendorTab, setActiveVendorTab] = useState<string | null>(null);

  // Load saved schedules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cafe_vendor_schedules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVendorSchedules(parsed);
      } catch (e) {
        console.error('Failed to load saved schedules:', e);
      }
    }
  }, []);

  // Save schedules to localStorage
  const saveSchedules = useCallback((schedules: VendorSchedule[]) => {
    setVendorSchedules(schedules);
    localStorage.setItem('cafe_vendor_schedules', JSON.stringify(schedules));
  }, []);

  // Get today's info
  const today = new Date().getDay();
  const todayName = DAYS_OF_WEEK[today];

  // Fetch cafe data from Square
  const handleSquareAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/square/cafe-analysis?weeks=${squareWeeks}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to analyze cafe sales from Square');
      }

      const result = await response.json();
      const data = result.data || result;
      setAnalysis(data);
      
      // Initialize stock to 0 for all items
      const initialStock: StockEntry = {};
      data.items.forEach((item: CafeItem) => {
        initialStock[item.variationId] = 0;
      });
      setCurrentStock(initialStock);

      // Set first vendor as active tab
      if (data.vendors && data.vendors.length > 0) {
        setActiveVendorTab(data.vendors[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Update stock for an item
  const updateStock = (itemId: string, value: number) => {
    setCurrentStock(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  // Get vendor schedule
  const getVendorSchedule = useCallback((vendorName: string): VendorSchedule | undefined => {
    return vendorSchedules.find(s => 
      s.name.toLowerCase() === vendorName.toLowerCase() ||
      vendorName.toLowerCase().includes(s.name.toLowerCase())
    );
  }, [vendorSchedules]);

  // Calculate order for a vendor
  const calculateVendorOrder = useCallback((vendorName: string) => {
    if (!analysis) return [];

    const schedule = getVendorSchedule(vendorName);
    const vendorItems = analysis.items.filter(item => 
      item.vendorName.toLowerCase().includes(vendorName.toLowerCase()) ||
      vendorName.toLowerCase().includes(item.vendorName.toLowerCase())
    );

    if (!schedule) {
      // If no schedule found, use default weekly calculation
      return vendorItems.map(item => {
        const stock = currentStock[item.variationId] || 0;
        const weeklyNeed = Math.ceil(item.avgPerWeek);
        const netNeeded = Math.max(0, weeklyNeed - stock);

        return {
          ...item,
          totalNeeded: weeklyNeed,
          currentStock: stock,
          netNeeded,
          orderQuantity: netNeeded,
        };
      });
    }

    // Calculate based on coverage days
    const coverageDays = schedule.coversDays.length || 7;
    
    return vendorItems.map(item => {
      const stock = currentStock[item.variationId] || 0;
      const dailyAvg = item.avgPerDay;
      const totalNeeded = Math.ceil(dailyAvg * coverageDays);
      const netNeeded = Math.max(0, totalNeeded - stock);

      // For "when-needed" vendors, check threshold
      let shouldOrder = true;
      if (schedule.frequency === 'when-needed' && schedule.whenNeededThreshold) {
        shouldOrder = stock <= schedule.whenNeededThreshold;
      }

      return {
        ...item,
        totalNeeded,
        currentStock: stock,
        netNeeded,
        orderQuantity: shouldOrder ? netNeeded : 0,
        belowThreshold: schedule.frequency === 'when-needed' && stock <= (schedule.whenNeededThreshold || 0),
      };
    });
  }, [analysis, currentStock, getVendorSchedule]);

  // Group items by vendor
  const itemsByVendor = useMemo(() => {
    if (!analysis) return {};

    const grouped: Record<string, CafeItem[]> = {};
    analysis.items.forEach(item => {
      const vendor = item.vendorName || 'Unknown Vendor';
      if (!grouped[vendor]) {
        grouped[vendor] = [];
      }
      grouped[vendor].push(item);
    });

    // Sort items within each vendor by avgPerDay descending
    Object.keys(grouped).forEach(vendor => {
      grouped[vendor].sort((a, b) => b.avgPerDay - a.avgPerDay);
    });

    return grouped;
  }, [analysis]);

  // Get all unique vendors
  const allVendors = useMemo(() => {
    return Object.keys(itemsByVendor).sort();
  }, [itemsByVendor]);

  // Update a vendor schedule
  const updateVendorSchedule = (scheduleId: string, updates: Partial<VendorSchedule>) => {
    const newSchedules = vendorSchedules.map(s => 
      s.id === scheduleId ? { ...s, ...updates } : s
    );
    saveSchedules(newSchedules);
  };

  // Add a new vendor schedule
  const addVendorSchedule = (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const colors = Object.keys(COLOR_CLASSES);
    const color = colors[vendorSchedules.length % colors.length];
    
    const newSchedule: VendorSchedule = {
      id,
      name,
      orderDay: 'Monday',
      deliveryDay: 'Tuesday',
      coversDays: ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'monday'],
      frequency: 'weekly',
      color,
      icon: '📦',
    };
    
    saveSchedules([...vendorSchedules, newSchedule]);
  };

  // Remove a vendor schedule
  const removeVendorSchedule = (scheduleId: string) => {
    saveSchedules(vendorSchedules.filter(s => s.id !== scheduleId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/wild-octave-new-logo.png"
                alt="Wild Octave Organics"
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Cafe Order Calculator</h1>
                <p className="text-sm text-gray-600">Multi-vendor ordering • {todayName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowScheduleEditor(!showScheduleEditor)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                ⚙️ Vendor Schedules
              </button>
              <Link href="/orders">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                  ← Orders
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Schedule Editor Modal */}
        {showScheduleEditor && (
          <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">📅 Vendor Schedules</h2>
              <button
                onClick={() => setShowScheduleEditor(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {vendorSchedules.map(schedule => (
                <div
                  key={schedule.id}
                  className={`p-4 rounded-lg border-2 ${COLOR_CLASSES[schedule.color]?.border || 'border-gray-200'} ${COLOR_CLASSES[schedule.color]?.light || 'bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{schedule.icon}</span>
                      <input
                        type="text"
                        value={schedule.name}
                        onChange={(e) => updateVendorSchedule(schedule.id, { name: e.target.value })}
                        className="font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => removeVendorSchedule(schedule.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Order Day</label>
                      <select
                        value={schedule.orderDay}
                        onChange={(e) => updateVendorSchedule(schedule.id, { orderDay: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                      >
                        {DAYS_OF_WEEK.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                        <option value="When Needed">When Needed</option>
                        <option value="In-House">In-House</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Order Time</label>
                      <input
                        type="text"
                        value={schedule.orderTime || ''}
                        onChange={(e) => updateVendorSchedule(schedule.id, { orderTime: e.target.value })}
                        placeholder="e.g. 12:00 PM"
                        className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Delivery Day</label>
                      <select
                        value={schedule.deliveryDay}
                        onChange={(e) => updateVendorSchedule(schedule.id, { deliveryDay: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                      >
                        {DAYS_OF_WEEK.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                        <option value="TBD">TBD</option>
                        <option value="Daily">Daily</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                      <select
                        value={schedule.frequency}
                        onChange={(e) => updateVendorSchedule(schedule.id, { frequency: e.target.value as VendorSchedule['frequency'] })}
                        className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="fortnightly">Fortnightly</option>
                        <option value="when-needed">When Needed</option>
                      </select>
                    </div>
                  </div>

                  {schedule.frequency === 'when-needed' && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">Reorder when stock falls to:</label>
                      <input
                        type="number"
                        value={schedule.whenNeededThreshold || 0}
                        onChange={(e) => updateVendorSchedule(schedule.id, { whenNeededThreshold: parseInt(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 rounded border border-gray-300 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add new vendor */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New vendor name..."
                  id="new-vendor-input"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        addVendorSchedule(input.value.trim());
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('new-vendor-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      addVendorSchedule(input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  + Add Vendor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Source Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📊 Cafe Sales Data</h2>
          
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weeks to Analyze</label>
              <select
                value={squareWeeks}
                onChange={(e) => setSquareWeeks(parseInt(e.target.value))}
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="2">2 weeks</option>
                <option value="4">4 weeks</option>
                <option value="6">6 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
              </select>
            </div>
            
            <button
              onClick={handleSquareAnalyze}
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '⏳ Analyzing...' : '⬛ Analyze Square Data'}
            </button>

            {analysis && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">{analysis.totalItemsSold}</span> items sold over{' '}
                <span className="font-medium">{analysis.totalDays}</span> days
                <span className="text-gray-400 ml-2">
                  ({analysis.dateRange.start} - {analysis.dateRange.end})
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Vendor Order Panels */}
        {analysis && allVendors.length > 0 && (
          <div className="space-y-6">
            {/* Vendor Tabs */}
            <div className="flex flex-wrap gap-2">
              {allVendors.map(vendor => {
                const schedule = getVendorSchedule(vendor);
                const colorClass = schedule ? COLOR_CLASSES[schedule.color] : COLOR_CLASSES.blue;
                const isActive = activeVendorTab === vendor || !activeVendorTab;
                
                return (
                  <button
                    key={vendor}
                    onClick={() => setActiveVendorTab(activeVendorTab === vendor ? null : vendor)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      isActive
                        ? `${colorClass?.bg} text-white shadow-md`
                        : `${colorClass?.light} ${colorClass?.text} hover:shadow`
                    }`}
                  >
                    {schedule?.icon || '📦'} {vendor}
                    <span className="ml-2 opacity-75">({itemsByVendor[vendor]?.length || 0})</span>
                  </button>
                );
              })}
            </div>

            {/* Vendor Panels */}
            {allVendors.map(vendor => {
              const schedule = getVendorSchedule(vendor);
              const colorClass = schedule ? COLOR_CLASSES[schedule.color] : COLOR_CLASSES.blue;
              const orderItems = calculateVendorOrder(vendor);
              const isVisible = activeVendorTab === vendor || !activeVendorTab;
              
              if (!isVisible) return null;

              return (
                <div
                  key={vendor}
                  className={`bg-white rounded-xl shadow-sm border-2 ${colorClass?.border || 'border-gray-200'} overflow-hidden`}
                >
                  {/* Vendor Header */}
                  <div className={`${colorClass?.bg || 'bg-gray-500'} text-white p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{schedule?.icon || '📦'}</span>
                        <div>
                          <h3 className="text-lg font-bold">{vendor}</h3>
                          <p className="text-sm opacity-90">
                            {schedule ? (
                              <>
                                Order: {schedule.orderDay}
                                {schedule.orderTime && ` by ${schedule.orderTime}`}
                                {' → '}
                                Delivery: {schedule.deliveryDay}
                                {schedule.deliveryTime && ` after ${schedule.deliveryTime}`}
                                {schedule.frequency !== 'weekly' && (
                                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                                    {schedule.frequency}
                                  </span>
                                )}
                              </>
                            ) : (
                              'No schedule configured'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {orderItems.filter(i => i.netNeeded > 0).length}
                        </div>
                        <div className="text-sm opacity-90">items to order</div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="p-4">
                    {schedule?.frequency === 'when-needed' && (
                      <div className={`mb-4 p-3 ${colorClass?.light} rounded-lg text-sm`}>
                        ⚠️ When-needed vendor: Order when stock falls to {schedule.whenNeededThreshold || 0} or below
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Item</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Avg/Day</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Need</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-24">Stock</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Net</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-24">Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, idx) => (
                            <tr
                              key={item.variationId}
                              className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50/50' : ''} ${
                                (item as any).belowThreshold ? 'bg-red-50' : ''
                              }`}
                            >
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900">{item.name}</div>
                                {item.variationName !== item.name && (
                                  <div className="text-xs text-gray-500">{item.variationName}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-sm text-gray-600">
                                {item.avgPerDay.toFixed(1)}
                              </td>
                              <td className="py-3 px-3 text-center font-medium">
                                {item.totalNeeded}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentStock[item.variationId] || 0}
                                  onChange={(e) => updateStock(item.variationId, parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`font-medium ${item.netNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                  {item.netNeeded}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`text-lg font-bold ${item.orderQuantity > 0 ? colorClass?.text : 'text-gray-400'}`}>
                                  {item.orderQuantity > 0 ? item.orderQuantity : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={`${colorClass?.light} border-t-2 ${colorClass?.border}`}>
                            <td colSpan={4} className="py-3 px-3 font-bold text-gray-900">
                              Total to Order
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-orange-600">
                              {orderItems.reduce((sum, i) => sum + i.netNeeded, 0)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`text-xl font-bold ${colorClass?.text}`}>
                                {orderItems.reduce((sum, i) => sum + i.orderQuantity, 0)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">☕</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to analyze cafe sales</h3>
            <p className="text-gray-600 mb-6">
              Click "Analyze Square Data" to pull cafe item sales and calculate orders by vendor
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
