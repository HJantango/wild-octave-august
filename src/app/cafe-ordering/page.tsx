'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PlusIcon, 
  TruckIcon, 
  PackageIcon, 
  CalendarIcon,
  SaveIcon,
  Trash2Icon,
  EditIcon,
  RefreshCwIcon,
  DownloadCloudIcon
} from 'lucide-react';

interface CafeItem {
  id: string;
  name: string;
  vendor: string;
  avgPerDay: number;
  avgPerWeek: number;
  currentStock: number;
  parLevel: number;
  orderQty: number;
  deliveryDays: string[];
  notes: string;
}

interface Vendor {
  id: string;
  name: string;
  deliveryDays: string[];
  contactInfo: string;
  items: CafeItem[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STORAGE_KEY = 'cafe-ordering-data';

// Default vendors and items
const defaultVendors: Vendor[] = [
  {
    id: 'yomify',
    name: 'Yomify',
    deliveryDays: ['Mon', 'Thu'],
    contactInfo: '',
    items: []
  },
  {
    id: 'liz-jackson',
    name: 'Liz Jackson',
    deliveryDays: ['Tue', 'Fri'],
    contactInfo: '',
    items: []
  },
  {
    id: 'byron-bay-pies',
    name: 'Byron Bay Pies',
    deliveryDays: ['Wed'],
    contactInfo: '',
    items: []
  },
  {
    id: 'samosas',
    name: 'Samosas',
    deliveryDays: ['Mon'],
    contactInfo: '',
    items: []
  },
  {
    id: 'love-bites',
    name: 'Love Bites',
    deliveryDays: ['Tue'],
    contactInfo: '',
    items: []
  },
  {
    id: 'byron-bay-brownies',
    name: 'Byron Bay Brownies',
    deliveryDays: ['Wed'],
    contactInfo: '',
    items: []
  },
  {
    id: 'house-made',
    name: 'House Made (Salads & Chia Cups)',
    deliveryDays: [],
    contactInfo: 'Made in-house',
    items: []
  },
];

export default function CafeOrderingPage() {
  const [vendors, setVendors] = useState<Vendor[]>(defaultVendors);
  const [editingItem, setEditingItem] = useState<{ vendorId: string; item: CafeItem } | null>(null);
  const [newItemVendor, setNewItemVendor] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSquare, setLoadingSquare] = useState(false);
  const [squareData, setSquareData] = useState<any>(null);

  // Load data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVendors(parsed.vendors || defaultVendors);
      } catch (e) {
        console.error('Failed to load cafe ordering data:', e);
      }
    }
  }, []);

  // Fetch Square sales data
  const fetchSquareData = async () => {
    setLoadingSquare(true);
    try {
      const response = await fetch('/api/reports/cafe-ordering?weeks=4');
      const result = await response.json();
      if (result.success) {
        setSquareData(result.data);
        // Auto-populate items from Square data
        populateFromSquare(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch Square data:', error);
    } finally {
      setLoadingSquare(false);
    }
  };

  // Populate vendors with Square data
  const populateFromSquare = (data: any) => {
    if (!data?.vendors) return;
    
    setVendors(prev => prev.map(vendor => {
      const squareVendor = data.vendors.find((v: any) => v.vendor === vendor.id);
      if (!squareVendor) return vendor;
      
      // Merge Square items with existing items
      const existingNames = new Set(vendor.items.map(i => i.name.toLowerCase()));
      const newItems: CafeItem[] = [];
      
      for (const sqItem of squareVendor.items) {
        if (!existingNames.has(sqItem.name.toLowerCase())) {
          newItems.push({
            id: `${vendor.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: sqItem.name,
            vendor: vendor.name,
            avgPerDay: sqItem.avgPerDay,
            avgPerWeek: sqItem.avgPerWeek,
            currentStock: 0,
            parLevel: Math.ceil(sqItem.avgPerDay * 2),
            orderQty: 0,
            deliveryDays: [],
            notes: `Auto-imported from Square (${sqItem.totalQty} sold in 4 weeks)`
          });
        }
      }
      
      // Update existing items with latest averages
      const updatedItems = vendor.items.map(item => {
        const sqItem = squareVendor.items.find((s: any) => 
          s.name.toLowerCase() === item.name.toLowerCase()
        );
        if (sqItem) {
          return {
            ...item,
            avgPerDay: sqItem.avgPerDay,
            avgPerWeek: sqItem.avgPerWeek,
          };
        }
        return item;
      });
      
      return {
        ...vendor,
        items: [...updatedItems, ...newItems]
      };
    }));
    
    setHasChanges(true);
  };

  // Save to localStorage
  const saveData = () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ vendors, savedAt: new Date().toISOString() }));
    setHasChanges(false);
    setTimeout(() => setSaving(false), 500);
  };

  // Add new item to vendor
  const addItem = (vendorId: string, item: Omit<CafeItem, 'id'>) => {
    setVendors(prev => prev.map(v => {
      if (v.id === vendorId) {
        return {
          ...v,
          items: [...v.items, { ...item, id: `${vendorId}-${Date.now()}` }]
        };
      }
      return v;
    }));
    setNewItemVendor(null);
    setHasChanges(true);
  };

  // Update item
  const updateItem = (vendorId: string, itemId: string, updates: Partial<CafeItem>) => {
    setVendors(prev => prev.map(v => {
      if (v.id === vendorId) {
        return {
          ...v,
          items: v.items.map(item => 
            item.id === itemId ? { ...item, ...updates } : item
          )
        };
      }
      return v;
    }));
    setHasChanges(true);
  };

  // Delete item
  const deleteItem = (vendorId: string, itemId: string) => {
    if (!confirm('Delete this item?')) return;
    setVendors(prev => prev.map(v => {
      if (v.id === vendorId) {
        return {
          ...v,
          items: v.items.filter(item => item.id !== itemId)
        };
      }
      return v;
    }));
    setHasChanges(true);
  };

  // Update vendor delivery days
  const updateVendorDays = (vendorId: string, days: string[]) => {
    setVendors(prev => prev.map(v => 
      v.id === vendorId ? { ...v, deliveryDays: days } : v
    ));
    setHasChanges(true);
  };

  // Calculate suggested order
  const calcSuggestedOrder = (item: CafeItem, daysUntilDelivery: number) => {
    const needed = (item.avgPerDay * daysUntilDelivery) + item.parLevel;
    return Math.max(0, Math.ceil(needed - item.currentStock));
  };

  // Get next delivery day for vendor
  const getNextDelivery = (deliveryDays: string[]) => {
    if (deliveryDays.length === 0) return 'N/A';
    const today = new Date().getDay();
    const dayMap: { [key: string]: number } = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    
    let minDays = 7;
    for (const day of deliveryDays) {
      const dayNum = dayMap[day];
      let diff = dayNum - today;
      if (diff <= 0) diff += 7;
      if (diff < minDays) minDays = diff;
    }
    return minDays === 1 ? 'Tomorrow' : minDays === 7 ? 'Today' : `${minDays} days`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-6 text-white">
          <div className="relative flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-1">☕ Cafe Ordering Dashboard</h1>
              <p className="text-orange-100">
                Manage cafe suppliers, track stock levels, and plan orders
              </p>
              {squareData && (
                <p className="text-orange-200 text-sm mt-1">
                  📊 Square data: {squareData.period.startDate} to {squareData.period.endDate} • {squareData.summary.totalQtySold} items sold • ${squareData.summary.totalRevenue.toFixed(0)} revenue
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchSquareData}
                disabled={loadingSquare}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <DownloadCloudIcon className={`w-4 h-4 mr-2 ${loadingSquare ? 'animate-spin' : ''}`} />
                {loadingSquare ? 'Syncing...' : 'Sync from Square'}
              </Button>
              <Button 
                onClick={saveData}
                disabled={saving}
                className={`${hasChanges ? 'bg-white text-orange-600 hover:bg-orange-50' : 'bg-white/20 hover:bg-white/30 text-white'}`}
              >
                <SaveIcon className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TruckIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendors</p>
                  <p className="text-2xl font-bold">{vendors.length}</p>
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
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{vendors.reduce((sum, v) => sum + v.items.length, 0)}</p>
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
                  <p className="text-sm text-gray-500">Deliveries Today</p>
                  <p className="text-2xl font-bold">
                    {vendors.filter(v => v.deliveryDays.includes(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1])).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <PackageIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-bold">
                    {vendors.reduce((sum, v) => sum + v.items.filter(i => i.currentStock <= i.parLevel).length, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vendors and Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vendors.map(vendor => (
            <Card key={vendor.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{vendor.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Deliveries:</span>
                      <div className="flex gap-1">
                        {DAYS.map(day => (
                          <button
                            key={day}
                            onClick={() => {
                              const newDays = vendor.deliveryDays.includes(day)
                                ? vendor.deliveryDays.filter(d => d !== day)
                                : [...vendor.deliveryDays, day];
                              updateVendorDays(vendor.id, newDays);
                            }}
                            className={`px-2 py-0.5 text-xs rounded ${
                              vendor.deliveryDays.includes(day)
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    {vendor.deliveryDays.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        Next delivery: {getNextDelivery(vendor.deliveryDays)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewItemVendor(vendor.id)}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {vendor.items.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No items yet. Click "Add Item" to start.
                  </div>
                ) : (
                  <div className="divide-y">
                    {vendor.items.map(item => (
                      <div key={item.id} className="p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                              <span>Avg: {item.avgPerDay}/day ({item.avgPerWeek}/wk)</span>
                              <span className={item.currentStock <= item.parLevel ? 'text-red-600 font-medium' : ''}>
                                Stock: {item.currentStock}
                              </span>
                              <span>Par: {item.parLevel}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Order</p>
                              <Input
                                type="number"
                                value={item.orderQty}
                                onChange={(e) => updateItem(vendor.id, item.id, { orderQty: parseInt(e.target.value) || 0 })}
                                className="w-16 h-8 text-center text-sm"
                              />
                            </div>
                            <button
                              onClick={() => deleteItem(vendor.id, item.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Item Modal */}
        {newItemVendor && (
          <AddItemModal
            vendorName={vendors.find(v => v.id === newItemVendor)?.name || ''}
            onAdd={(item) => addItem(newItemVendor, item)}
            onClose={() => setNewItemVendor(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// Add Item Modal Component
function AddItemModal({ 
  vendorName, 
  onAdd, 
  onClose 
}: { 
  vendorName: string;
  onAdd: (item: Omit<CafeItem, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [avgPerDay, setAvgPerDay] = useState(1);
  const [parLevel, setParLevel] = useState(2);
  const [currentStock, setCurrentStock] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onAdd({
      name: name.trim(),
      vendor: vendorName,
      avgPerDay,
      avgPerWeek: avgPerDay * 7,
      currentStock,
      parLevel,
      orderQty: 0,
      deliveryDays: [],
      notes: ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold mb-4">Add Item to {vendorName}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Item Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Blueberry Muffin"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Avg/Day</label>
              <Input
                type="number"
                value={avgPerDay}
                onChange={(e) => setAvgPerDay(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Par Level</label>
              <Input
                type="number"
                value={parLevel}
                onChange={(e) => setParLevel(parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Current Stock</label>
              <Input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
              Add Item
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
