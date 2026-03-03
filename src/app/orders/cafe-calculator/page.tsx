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

// Pack size for items sold by piece but ordered as whole units
interface PackSizeEntry {
  packSize: number;
  unitName: string; // e.g., "cake", "lasagne", "tray"
}

interface PackSizeConfig {
  [itemId: string]: PackSizeEntry;
}

// Default pack size patterns - match by item name substring
const DEFAULT_PACK_SIZE_PATTERNS: Record<string, PackSizeEntry> = {
  'cake': { packSize: 12, unitName: 'cake' },
  'cheesecake': { packSize: 12, unitName: 'cake' },
  'pie': { packSize: 12, unitName: 'pie' },
  'tart': { packSize: 8, unitName: 'tart' },
  'quiche': { packSize: 8, unitName: 'quiche' },
  'lasagne': { packSize: 12, unitName: 'lasagne' },
  'lasagna': { packSize: 12, unitName: 'lasagna' },
};

// Vendor quota - target number of whole units (cakes) to order
interface VendorQuota {
  targetUnits: number; // e.g., 6 cakes
  packSize: number; // e.g., 12 slices per cake
  unitName: string; // e.g., "cake"
}

interface VendorQuotaConfig {
  [vendorId: string]: VendorQuota;
}

// Item role - core (always order) vs rotation (swap in/out)
type ItemRole = 'core' | 'rotation' | 'skip';

interface ItemRoleConfig {
  [itemId: string]: ItemRole;
}

// Selected items for ordering
interface ItemSelectionConfig {
  [itemId: string]: boolean;
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
  const [packSizes, setPackSizes] = useState<PackSizeConfig>({});
  const [vendorQuotas, setVendorQuotas] = useState<VendorQuotaConfig>({});
  const [itemRoles, setItemRoles] = useState<ItemRoleConfig>({});
  const [itemSelections, setItemSelections] = useState<ItemSelectionConfig>({});
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

  // Load saved pack sizes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cafe_pack_sizes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPackSizes(parsed);
      } catch (e) {
        console.error('Failed to load saved pack sizes:', e);
      }
    }
  }, []);

  // Get pack size for an item (check saved first, then default patterns)
  const getPackSizeForItem = useCallback((itemId: string, itemName: string): PackSizeEntry | null => {
    // Check if user has explicitly set a pack size
    if (packSizes[itemId]) {
      // Return null if explicitly set to 0 (disabled)
      if (packSizes[itemId].packSize === 0) return null;
      return packSizes[itemId];
    }
    
    // Check default patterns
    const nameLower = itemName.toLowerCase();
    for (const [pattern, config] of Object.entries(DEFAULT_PACK_SIZE_PATTERNS)) {
      if (nameLower.includes(pattern)) {
        return config;
      }
    }
    
    return null;
  }, [packSizes]);

  // Update pack size for an item
  const updatePackSize = useCallback((itemId: string, packSize: number, unitName: string) => {
    setPackSizes(prev => {
      const updated = {
        ...prev,
        [itemId]: { packSize, unitName }
      };
      localStorage.setItem('cafe_pack_sizes', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear pack size override for an item (use default pattern)
  const clearPackSizeOverride = useCallback((itemId: string) => {
    setPackSizes(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      localStorage.setItem('cafe_pack_sizes', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load saved vendor quotas from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cafe_vendor_quotas');
    if (saved) {
      try {
        setVendorQuotas(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load vendor quotas:', e);
      }
    }
  }, []);

  // Load saved item roles from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cafe_item_roles');
    if (saved) {
      try {
        setItemRoles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load item roles:', e);
      }
    }
  }, []);

  // Load saved item selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cafe_item_selections');
    if (saved) {
      try {
        setItemSelections(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load item selections:', e);
      }
    }
  }, []);

  // Update vendor quota
  const updateVendorQuota = useCallback((vendorId: string, targetUnits: number, packSize: number = 12, unitName: string = 'cake') => {
    setVendorQuotas(prev => {
      const updated = { ...prev, [vendorId]: { targetUnits, packSize, unitName } };
      localStorage.setItem('cafe_vendor_quotas', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update item role
  const updateItemRole = useCallback((itemId: string, role: ItemRole) => {
    setItemRoles(prev => {
      const updated = { ...prev, [itemId]: role };
      localStorage.setItem('cafe_item_roles', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Toggle item selection
  const toggleItemSelection = useCallback((itemId: string) => {
    setItemSelections(prev => {
      const updated = { ...prev, [itemId]: !prev[itemId] };
      localStorage.setItem('cafe_item_selections', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Get item role (default based on sales rank)
  const getItemRole = useCallback((itemId: string): ItemRole => {
    return itemRoles[itemId] || 'rotation'; // Default to rotation
  }, [itemRoles]);

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
        
        // Get pack size info
        const packInfo = getPackSizeForItem(item.variationId, item.name);
        const hasPackSize = packInfo !== null;
        const packSize = packInfo?.packSize || 1;
        const unitName = packInfo?.unitName || 'unit';
        
        // Calculate units to order (round up)
        const unitsToOrder = hasPackSize ? Math.ceil(netNeeded / packSize) : netNeeded;

        return {
          ...item,
          totalNeeded: weeklyNeed,
          currentStock: stock,
          netNeeded,
          orderQuantity: netNeeded,
          // Pack size fields
          hasPackSize,
          packSize,
          unitName,
          unitsToOrder,
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

      // Get pack size info
      const packInfo = getPackSizeForItem(item.variationId, item.name);
      const hasPackSize = packInfo !== null;
      const packSize = packInfo?.packSize || 1;
      const unitName = packInfo?.unitName || 'unit';
      
      // Calculate units to order (round up)
      const rawUnitsNeeded = hasPackSize ? Math.ceil(netNeeded / packSize) : netNeeded;
      const unitsToOrder = shouldOrder ? rawUnitsNeeded : 0;

      return {
        ...item,
        totalNeeded,
        currentStock: stock,
        netNeeded,
        orderQuantity: shouldOrder ? netNeeded : 0,
        belowThreshold: schedule.frequency === 'when-needed' && stock <= (schedule.whenNeededThreshold || 0),
        // Pack size fields
        hasPackSize,
        packSize,
        unitName,
        unitsToOrder,
      };
    });
  }, [analysis, currentStock, getVendorSchedule, getPackSizeForItem]);

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

  // Calculate vendor summaries (total slices/cakes per week)
  const vendorSummaries = useMemo(() => {
    const summaries: Record<string, {
      totalSlicesPerWeek: number;
      cakesPerWeek: number;
      packSize: number;
      unitName: string;
      itemCount: number;
      coreItems: number;
      rotationItems: number;
      selectedCount: number;
      selectedCakes: number;
    }> = {};

    Object.entries(itemsByVendor).forEach(([vendor, items]) => {
      const vendorId = vendor.toLowerCase().replace(/\s+/g, '-');
      const quota = vendorQuotas[vendorId];
      const packSize = quota?.packSize || 12;
      const unitName = quota?.unitName || 'cake';

      let totalSlices = 0;
      let coreCount = 0;
      let rotationCount = 0;
      let selectedCount = 0;
      let selectedSlices = 0;

      items.forEach((item, idx) => {
        const slicesPerWeek = item.avgPerWeek;
        totalSlices += slicesPerWeek;

        const role = getItemRole(item.variationId);
        if (role === 'core') coreCount++;
        else if (role === 'rotation') rotationCount++;

        // Check if selected (default: top items up to quota are selected)
        const isSelected = itemSelections[item.variationId] ?? (idx < (quota?.targetUnits || 6));
        if (isSelected && role !== 'skip') {
          selectedCount++;
          // Each selected item = 1 whole unit (cake)
          selectedSlices += packSize;
        }
      });

      summaries[vendor] = {
        totalSlicesPerWeek: Math.round(totalSlices * 10) / 10,
        cakesPerWeek: Math.round((totalSlices / packSize) * 10) / 10,
        packSize,
        unitName,
        itemCount: items.length,
        coreItems: coreCount,
        rotationItems: rotationCount,
        selectedCount,
        selectedCakes: selectedCount, // 1 item = 1 cake for ordering
      };
    });

    return summaries;
  }, [itemsByVendor, vendorQuotas, itemRoles, itemSelections, getItemRole]);

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
              const vendorId = vendor.toLowerCase().replace(/\s+/g, '-');
              const summary = vendorSummaries[vendor];
              const quota = vendorQuotas[vendorId];
              const targetUnits = quota?.targetUnits ?? Math.round(summary?.cakesPerWeek || 6);
              
              if (!isVisible) return null;

              return (
                <div
                  key={vendor}
                  className={`bg-white rounded-xl shadow-sm border-2 ${colorClass?.border || 'border-gray-200'} overflow-hidden`}
                >
                  {/* Vendor Header */}
                  <div className={`${colorClass?.bg || 'bg-gray-500'} text-white p-4`}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
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
                              </>
                            ) : (
                              'No schedule configured'
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {/* Weekly Stats */}
                      {summary && (
                        <div className="flex items-center gap-4 bg-white/10 rounded-lg px-4 py-2">
                          <div className="text-center">
                            <div className="text-lg font-bold">{summary.totalSlicesPerWeek}</div>
                            <div className="text-xs opacity-75">slices/wk</div>
                          </div>
                          <div className="text-2xl opacity-50">→</div>
                          <div className="text-center">
                            <div className="text-lg font-bold">{summary.cakesPerWeek}</div>
                            <div className="text-xs opacity-75">{summary.unitName}s/wk</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Order Target */}
                      <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium">Target:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={targetUnits}
                          onChange={(e) => updateVendorQuota(vendorId, parseInt(e.target.value) || 0)}
                          className="w-14 px-2 py-1 text-center rounded bg-white text-gray-900 font-bold text-lg"
                        />
                        <span className="text-sm">{summary?.unitName || 'cake'}s</span>
                      </div>
                      
                      {/* Selected Count */}
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          (summary?.selectedCount || 0) === targetUnits ? 'text-green-200' : 
                          (summary?.selectedCount || 0) > targetUnits ? 'text-yellow-200' : ''
                        }`}>
                          {summary?.selectedCount || 0}/{targetUnits}
                        </div>
                        <div className="text-sm opacity-90">{summary?.unitName || 'cake'}s selected</div>
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
                            <th className="text-center py-2 px-2 font-semibold text-gray-700 w-10">✓</th>
                            <th className="text-center py-2 px-2 font-semibold text-gray-700 w-12">Role</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Item</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Avg/Day</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Avg/Wk</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-24">Stock</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700 w-20">Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, idx) => {
                            const role = getItemRole(item.variationId);
                            const isSelected = itemSelections[item.variationId] ?? (idx < targetUnits);
                            const isSkipped = role === 'skip';
                            
                            return (
                            <tr
                              key={item.variationId}
                              className={`border-b border-gray-100 ${
                                isSkipped ? 'opacity-40' :
                                isSelected ? (colorClass?.light || 'bg-blue-50') : 
                                idx % 2 === 0 ? 'bg-gray-50/50' : ''
                              }`}
                            >
                              {/* Selection Checkbox */}
                              <td className="py-3 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected && !isSkipped}
                                  disabled={isSkipped}
                                  onChange={() => toggleItemSelection(item.variationId)}
                                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                              </td>
                              
                              {/* Role Toggle */}
                              <td className="py-3 px-2 text-center">
                                <button
                                  onClick={() => {
                                    const nextRole: ItemRole = role === 'core' ? 'rotation' : role === 'rotation' ? 'skip' : 'core';
                                    updateItemRole(item.variationId, nextRole);
                                  }}
                                  className={`text-lg ${
                                    role === 'core' ? 'text-yellow-500' : 
                                    role === 'skip' ? 'text-gray-300' : 'text-blue-400'
                                  }`}
                                  title={role === 'core' ? 'Core (always order)' : role === 'skip' ? 'Skip (never order)' : 'Rotation (swap in/out)'}
                                >
                                  {role === 'core' ? '⭐' : role === 'skip' ? '⊘' : '🔄'}
                                </button>
                              </td>
                              
                              {/* Item Name */}
                              <td className="py-3 px-3">
                                <div className={`font-medium ${isSkipped ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  {item.name}
                                </div>
                                {item.variationName !== item.name && (
                                  <div className="text-xs text-gray-500">{item.variationName}</div>
                                )}
                              </td>
                              
                              {/* Avg/Day */}
                              <td className="py-3 px-3 text-center text-sm text-gray-600">
                                {item.avgPerDay.toFixed(1)}
                              </td>
                              
                              {/* Avg/Week (slices) */}
                              <td className="py-3 px-3 text-center text-sm text-gray-600">
                                {item.avgPerWeek.toFixed(0)}
                              </td>
                              
                              {/* Stock */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentStock[item.variationId] || 0}
                                  onChange={(e) => updateStock(item.variationId, parseInt(e.target.value) || 0)}
                                  className="w-14 px-2 py-1 text-center border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                                />
                              </td>
                              
                              {/* Order (1 unit per selected item) */}
                              <td className="py-3 px-3 text-center">
                                {isSelected && !isSkipped ? (
                                  <span className={`text-lg font-bold ${colorClass?.text}`}>
                                    1
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className={`${colorClass?.light} border-t-2 ${colorClass?.border}`}>
                            <td colSpan={2} className="py-3 px-3"></td>
                            <td className="py-3 px-3 font-bold text-gray-900">
                              Order Total
                            </td>
                            <td colSpan={2} className="py-3 px-3 text-center text-sm text-gray-600">
                              {orderItems.reduce((sum, i) => sum + i.avgPerWeek, 0).toFixed(0)} slices/wk demand
                            </td>
                            <td className="py-3 px-3"></td>
                            <td className="py-3 px-3 text-center">
                              <span className={`text-xl font-bold ${colorClass?.text}`}>
                                {summary?.selectedCount || 0} {summary?.unitName || 'cake'}s
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
