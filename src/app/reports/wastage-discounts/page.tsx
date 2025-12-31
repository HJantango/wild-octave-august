'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WastageDiscountItem {
  itemId?: string;
  itemName: string;
  vendorName?: string;
  category?: string;
  subcategory?: string;
  wastageQty: number;
  wastageCost: number;
  discountQty: number;
  discountAmount: number;
  totalLoss: number;
  recommendation?: string;
}

interface DiscountTypeBreakdown {
  type: string;
  count: number;
  amount: number;
}

interface WastageHistoryItem {
  date: string;
  type: 'wastage';
  adjustmentType: string;
  quantity: number;
  cost: number;
  location?: string;
}

interface DiscountHistoryItem {
  date: string;
  type: 'discount';
  discountType?: string;
  discountPercent?: number;
  discountAmount: number;
  quantity: number;
  originalPrice?: number;
  finalPrice?: number;
}

interface ItemHistory {
  itemName: string;
  itemId?: string;
  wastageHistory: WastageHistoryItem[];
  discountHistory: DiscountHistoryItem[];
  totals: {
    wastageQty: number;
    wastageCost: number;
    discountQty: number;
    discountAmount: number;
    totalLoss: number;
    discount25Percent: number;
    discount50Percent: number;
  };
}

interface DiscountDetailItem {
  itemName: string;
  discountType: string;
  discountAmount: number;
  discountPercent: number | null;
  quantity: number;
  saleDate: string;
}

export default function WastageDiscountsPage() {
  const toast = useToast();
  const [wastageFile, setWastageFile] = useState<File | null>(null);
  const [discountFile, setDiscountFile] = useState<File | null>(null);
  const [rewardsFile, setRewardsFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [data, setData] = useState<WastageDiscountItem[]>([]);
  const [discountBreakdown, setDiscountBreakdown] = useState<DiscountTypeBreakdown[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemHistory | null>(null);
  const [selectedDiscountType, setSelectedDiscountType] = useState<string | null>(null);
  const [discountDetails, setDiscountDetails] = useState<DiscountDetailItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('totalLoss');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showReviewOnly, setShowReviewOnly] = useState<boolean>(false);
  const [modalSortColumn, setModalSortColumn] = useState<string>('itemName');
  const [modalSortDirection, setModalSortDirection] = useState<'asc' | 'desc'>('asc');
  const [actionedItems, setActionedItems] = useState<Set<string>>(new Set());

  const handleWastageUpload = async () => {
    if (!wastageFile) {
      toast.error('Please select a wastage CSV file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', wastageFile);

      const response = await fetch('/api/wastage/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import wastage data');
      }

      toast.success(`Imported ${result.data.summary.imported} wastage records`);
      setWastageFile(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDiscountUpload = async (source: 'regular' | 'rewards') => {
    const file = source === 'regular' ? discountFile : rewardsFile;
    const setFile = source === 'regular' ? setDiscountFile : setRewardsFile;

    if (!file) {
      toast.error(`Please select a ${source} discount CSV file`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discountSource', source);

      const response = await fetch('/api/discounts/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import discount data');
      }

      toast.success(`Imported ${result.data.summary.imported} ${source} discount records`);
      setFile(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const loadData = async () => {
    try {
      const response = await fetch(
        `/api/reports/wastage-discounts?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      const result = await response.json();

      if (response.ok) {
        setData(result.data.items || []);
        setDiscountBreakdown(result.data.discountTypeBreakdown || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  // Load actioned items from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wastage_actioned_items');
      if (saved) {
        setActionedItems(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.error('Failed to load actioned items:', error);
    }
  }, []);

  // Save actioned items to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('wastage_actioned_items', JSON.stringify(Array.from(actionedItems)));
    } catch (error) {
      console.error('Failed to save actioned items:', error);
    }
  }, [actionedItems]);

  const toggleActionedItem = (itemName: string) => {
    setActionedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const clearActionedItems = () => {
    if (confirm('Are you sure you want to clear all actioned items?')) {
      setActionedItems(new Set());
      toast.success('Cleared all actioned items');
    }
  };

  const handleItemClick = async (item: WastageDiscountItem) => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams({
        itemName: item.itemName,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      if (item.itemId) {
        params.set('itemId', item.itemId);
      }

      const response = await fetch(`/api/reports/wastage-discounts/item-history?${params}`);
      const result = await response.json();

      if (response.ok) {
        setSelectedItem(result.data);
      } else {
        toast.error('Failed to load item history');
      }
    } catch (error) {
      console.error('Failed to load item history:', error);
      toast.error('Failed to load item history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleClearWastage = async () => {
    if (!confirm('Are you sure you want to delete ALL wastage records? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/wastage/clear', { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        toast.success(`Deleted ${result.data.deletedCount} wastage records`);
        await loadData();
      } else {
        toast.error('Failed to clear wastage data');
      }
    } catch (error) {
      console.error('Failed to clear wastage data:', error);
      toast.error('Failed to clear wastage data');
    }
  };

  const handleClearDiscounts = async () => {
    if (!confirm('Are you sure you want to delete ALL discount records? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/discounts/clear', { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        toast.success(`Deleted ${result.data.deletedCount} discount records`);
        await loadData();
      } else {
        toast.error('Failed to clear discount data');
      }
    } catch (error) {
      console.error('Failed to clear discount data:', error);
      toast.error('Failed to clear discount data');
    }
  };

  const handleDiscountTypeClick = async (discountType: string) => {
    setIsLoadingDetails(true);
    setSelectedDiscountType(discountType);

    try {
      const params = new URLSearchParams({
        discountType,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      const response = await fetch(`/api/reports/wastage-discounts/discount-details?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load discount details');
      }

      setDiscountDetails(result.data);
    } catch (error: any) {
      console.error('Failed to load discount details:', error);
      toast.error(error.message || 'Failed to load discount details');
      setSelectedDiscountType(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleModalSort = (column: string) => {
    if (modalSortColumn === column) {
      setModalSortDirection(modalSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setModalSortColumn(column);
      setModalSortDirection('asc');
    }
  };

  // Apply filters to data
  const filteredData = data.filter(item => {
    // Search filter
    if (searchTerm && !item.itemName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    // Discount type filter (requires fetching discount records per item - we'll use a simpler approach)
    // For now, we'll just filter to show items with discounts when 25% or 50% is selected
    if (discountTypeFilter === '25%' || discountTypeFilter === '50%') {
      if (item.discountQty === 0) return false;
    }

    // Review filter - show only items with "Order Less" or "Review" actions
    if (showReviewOnly) {
      const criticalLoss = item.totalLoss > 50;
      const highWastage = item.wastageQty > 5;
      const highDiscount = item.discountQty > 5;
      const hasAction = criticalLoss || highWastage || highDiscount;
      if (!hasAction) return false;
    }

    return true;
  }).sort((a, b) => {
    let aVal: any;
    let bVal: any;

    // Special handling for action column sorting
    if (sortColumn === 'action') {
      // Assign priority: Order Less (1) > Review (2) > None (3)
      const getActionPriority = (item: WastageDiscountItem) => {
        const criticalLoss = item.totalLoss > 50;
        const highWastage = item.wastageQty > 5;
        const highDiscount = item.discountQty > 5;
        if (criticalLoss) return 1;
        if (highWastage || highDiscount) return 2;
        return 3;
      };
      aVal = getActionPriority(a);
      bVal = getActionPriority(b);
    } else {
      aVal = a[sortColumn as keyof WastageDiscountItem];
      bVal = b[sortColumn as keyof WastageDiscountItem];

      // Handle string sorting (itemName, category)
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  const summary = {
    totalWastageCost: filteredData.reduce((sum, item) => sum + item.wastageCost, 0),
    totalWastageQty: filteredData.reduce((sum, item) => sum + item.wastageQty, 0),
    totalDiscountAmount: filteredData.reduce((sum, item) => sum + item.discountAmount, 0),
    totalDiscountQty: filteredData.reduce((sum, item) => sum + item.discountQty, 0),
    totalLoss: filteredData.reduce((sum, item) => sum + item.totalLoss, 0),
    itemsWithWastage: filteredData.filter(item => item.wastageQty > 0).length,
    itemsWithDiscounts: filteredData.filter(item => item.discountQty > 0).length,
  };

  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(data.map(item => item.category).filter(Boolean))).sort();

  // Prepare chart data for top discounted items (combined 25% and 50%)
  const topDiscountedItems = [...data]
    .filter(item => item.discountAmount > 0)
    .sort((a, b) => b.discountAmount - a.discountAmount)
    .slice(0, 10)
    .map(item => ({
      name: item.itemName.length > 25 ? item.itemName.substring(0, 25) + '...' : item.itemName,
      amount: Number(item.discountAmount.toFixed(2)),
    }));

  const topWastedItems = [...data]
    .filter(item => item.wastageCost > 0)
    .sort((a, b) => b.wastageCost - a.wastageCost)
    .slice(0, 10)
    .map(item => ({
      name: item.itemName.length > 25 ? item.itemName.substring(0, 25) + '...' : item.itemName,
      cost: Number(item.wastageCost.toFixed(2)),
    }));

  // Sort discount details for modal
  const sortedDiscountDetails = [...discountDetails].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (modalSortColumn) {
      case 'itemName':
        aVal = a.itemName.toLowerCase();
        bVal = b.itemName.toLowerCase();
        break;
      case 'saleDate':
        aVal = new Date(a.saleDate).getTime();
        bVal = new Date(b.saleDate).getTime();
        break;
      case 'quantity':
        aVal = a.quantity;
        bVal = b.quantity;
        break;
      case 'discountPercent':
        aVal = a.discountPercent || 0;
        bVal = b.discountPercent || 0;
        break;
      case 'discountAmount':
        aVal = a.discountAmount;
        bVal = b.discountAmount;
        break;
      default:
        aVal = a.itemName.toLowerCase();
        bVal = b.itemName.toLowerCase();
    }

    if (modalSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  return (
    <DashboardLayout title="Wastage & Discounts Report">
      <div className="space-y-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Import Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wastage Upload */}
            <div>
              <Label htmlFor="wastage-upload">Square Inventory History CSV (Wastage)</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="file"
                  id="wastage-upload"
                  accept=".csv"
                  onChange={(e) => setWastageFile(e.target.files?.[0] || null)}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={handleWastageUpload}
                  disabled={!wastageFile || isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
                <Button
                  onClick={handleClearWastage}
                  disabled={isUploading}
                  variant="destructive"
                >
                  Clear
                </Button>
              </div>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-900 font-semibold mb-1">📍 Where to find this in Square:</p>
                <p className="text-xs text-blue-800">
                  <strong>Items & Inventory</strong> → <strong>Inventory Management</strong> → <strong>History</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Filter by <strong>Adjustment Types: Loss & Damage</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1 italic">
                  File name example: inventory-history-2025-12-29.csv
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Regular Discount Upload */}
              <div>
                <Label htmlFor="discount-upload">Regular Discounts CSV (Excluding Rewards)</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="file"
                    id="discount-upload"
                    accept=".csv"
                    onChange={(e) => setDiscountFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => handleDiscountUpload('regular')}
                    disabled={!discountFile || isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-900 font-semibold mb-1">📍 Where to find this in Square:</p>
                  <p className="text-xs text-green-800">
                    <strong>Reports</strong> → <strong>Sales</strong> → <strong>Item Sales</strong>
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Filter by <strong>Discounts (tick all EXCEPT Rewards Program)</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-1 italic">
                    File name example: items-2025-12-01-2025-12-30.csv
                  </p>
                </div>
              </div>

              {/* Rewards Program Upload */}
              <div>
                <Label htmlFor="rewards-upload">Rewards Program Discounts CSV</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="file"
                    id="rewards-upload"
                    accept=".csv"
                    onChange={(e) => setRewardsFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => handleDiscountUpload('rewards')}
                    disabled={!rewardsFile || isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
                <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                  <p className="text-xs text-purple-900 font-semibold mb-1">📍 Where to find this in Square:</p>
                  <p className="text-xs text-purple-800">
                    <strong>Reports</strong> → <strong>Sales</strong> → <strong>Item Sales</strong>
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Filter by <strong>Discounts: Rewards Program ONLY</strong>
                  </p>
                  <p className="text-xs text-purple-600 mt-1 italic">
                    File name example: items-2025-12-01-2025-12-30-rewards.csv
                  </p>
                </div>
              </div>
            </div>

            {/* Clear All Discounts Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleClearDiscounts}
                disabled={isUploading}
                variant="destructive"
              >
                Clear All Discounts
              </Button>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-end gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <input
                  type="date"
                  id="start-date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <input
                  type="date"
                  id="end-date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <Button onClick={loadData}>Refresh</Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-red-50">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-red-600">Total Wastage Cost</div>
              <div className="text-2xl font-bold text-red-700">${summary.totalWastageCost.toFixed(2)}</div>
              <div className="text-xs text-red-500 mt-1">{summary.totalWastageQty.toFixed(0)} units lost</div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-yellow-700">Total Written Down Discounts</div>
              <div className="text-2xl font-bold text-yellow-800">
                ${(() => {
                  const discount25 = discountBreakdown.find(d => d.type === '25% Discount')?.amount || 0;
                  const discount50 = discountBreakdown.find(d => d.type === '50% Discount')?.amount || 0;
                  return (discount25 + discount50).toFixed(2);
                })()}
              </div>
              <div className="text-xs text-yellow-600 mt-1">25% + 50% Discounts</div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-orange-600">Total Discounts</div>
              <div className="text-2xl font-bold text-orange-700">${summary.totalDiscountAmount.toFixed(2)}</div>
              <div className="text-xs text-orange-500 mt-1">{summary.totalDiscountQty.toFixed(0)} units discounted</div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-purple-600">Total Loss</div>
              <div className="text-2xl font-bold text-purple-700">${summary.totalLoss.toFixed(2)}</div>
              <div className="text-xs text-purple-500 mt-1">Wastage + Discounts</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-gray-600">Items Affected</div>
              <div className="text-2xl font-bold text-gray-900">{data.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.itemsWithWastage} wasted | {summary.itemsWithDiscounts} discounted
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operational vs Strategic Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-rose-50 border-2 border-rose-200">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-rose-700">Operational Losses</div>
              <div className="text-2xl font-bold text-rose-800">
                ${(() => {
                  const wastage = summary.totalWastageCost;
                  const discount25 = discountBreakdown.find(d => d.type === '25% Discount')?.amount || 0;
                  const discount50 = discountBreakdown.find(d => d.type === '50% Discount')?.amount || 0;
                  return (wastage + discount25 + discount50).toFixed(2);
                })()}
              </div>
              <div className="text-xs text-rose-600 mt-1">Wastage + 25%/50% Discounts</div>
              <div className="text-xs text-rose-500 mt-2 font-semibold">Actual product loss</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-blue-700">Strategic Costs</div>
              <div className="text-2xl font-bold text-blue-800">
                ${(() => {
                  const rewards = discountBreakdown.find(d => d.type === 'Rewards Program')?.amount || 0;
                  const staff = discountBreakdown.find(d => d.type === '15% - Staff Discount')?.amount || 0;
                  const customer = discountBreakdown.find(d => d.type === '10% - Customer Discount')?.amount || 0;
                  const fullComp = discountBreakdown.find(d => d.type === '100% - Full Comp')?.amount || 0;
                  return (rewards + staff + customer + fullComp).toFixed(2);
                })()}
              </div>
              <div className="text-xs text-blue-600 mt-1">Rewards + Staff + 10% Customer + Full Comps</div>
              <div className="text-xs text-blue-500 mt-2 font-semibold">Intentional benefits</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-slate-700">Other Discounts</div>
              <div className="text-2xl font-bold text-slate-800">
                ${(() => {
                  const total = summary.totalDiscountAmount;
                  const discount25 = discountBreakdown.find(d => d.type === '25% Discount')?.amount || 0;
                  const discount50 = discountBreakdown.find(d => d.type === '50% Discount')?.amount || 0;
                  const rewards = discountBreakdown.find(d => d.type === 'Rewards Program')?.amount || 0;
                  const staff = discountBreakdown.find(d => d.type === '15% - Staff Discount')?.amount || 0;
                  const customer = discountBreakdown.find(d => d.type === '10% - Customer Discount')?.amount || 0;
                  const fullComp = discountBreakdown.find(d => d.type === '100% - Full Comp')?.amount || 0;
                  const other = total - discount25 - discount50 - rewards - staff - customer - fullComp;
                  return other.toFixed(2);
                })()}
              </div>
              <div className="text-xs text-slate-600 mt-1">Misc discounts</div>
              <div className="text-xs text-slate-500 mt-2 font-semibold">Uncategorized</div>
            </CardContent>
          </Card>
        </div>

        {/* Discount Type Breakdown */}
        {discountBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Discount Type Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                  const breakdownMap = new Map(discountBreakdown.map(b => [b.type, b]));
                  const orderedTypes = [
                    { key: '50% Discount', label: '50% Discount', clickable: true },
                    { key: '25% Discount', label: '25% Discount', clickable: true },
                    { key: '15% - Staff Discount', label: '15% Staff Discount', clickable: false },
                    { key: '10% - Customer Discount', label: '10% Old Customer Discount', clickable: false },
                    { key: '100% - Full Comp', label: '100% Full Comp', clickable: false },
                    { key: 'Rewards Program', label: 'Rewards Program', clickable: false },
                  ];

                  // Calculate "Others" total
                  const knownTypes = new Set(orderedTypes.map(t => t.key));
                  const othersTotal = discountBreakdown
                    .filter(b => !knownTypes.has(b.type))
                    .reduce((sum, b) => sum + b.amount, 0);
                  const othersCount = discountBreakdown
                    .filter(b => !knownTypes.has(b.type))
                    .reduce((sum, b) => sum + b.count, 0);

                  const cards = orderedTypes
                    .map(({ key, label, clickable }) => {
                      const breakdown = breakdownMap.get(key);
                      if (!breakdown) return null;

                      return (
                        <div
                          key={key}
                          onClick={() => clickable && handleDiscountTypeClick(key)}
                          className={`border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 ${
                            clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-600">{label}</div>
                          <div className="text-2xl font-bold text-indigo-700">${breakdown.amount.toFixed(2)}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {breakdown.count} transactions
                            {clickable && <span className="ml-1">📊</span>}
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean);

                  // Add "Others" card if there are unmatched types
                  if (othersTotal > 0) {
                    cards.push(
                      <div
                        key="others"
                        className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100"
                      >
                        <div className="text-sm font-medium text-gray-600">Others</div>
                        <div className="text-2xl font-bold text-gray-700">${othersTotal.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">{othersCount} transactions</div>
                      </div>
                    );
                  }

                  return cards;
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Section */}
        {data.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Discounted Items (25% & 50%) */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Discounted Items (25% & 50%)</CardTitle>
              </CardHeader>
              <CardContent>
                {topDiscountedItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topDiscountedItems}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                        labelStyle={{ fontSize: 12 }}
                      />
                      <Legend />
                      <Bar dataKey="amount" fill="#f59e0b" name="Discount Amount ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No discount data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top Wasted Items */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Wasted Items</CardTitle>
              </CardHeader>
              <CardContent>
                {topWastedItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topWastedItems}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                        labelStyle={{ fontSize: 12 }}
                      />
                      <Legend />
                      <Bar dataKey="cost" fill="#ef4444" name="Wastage Cost ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No wastage data available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No data available. Upload wastage and discount CSVs to see the report.
              </p>
            ) : (
              <>
                {/* Filters */}
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div>
                    <Label htmlFor="search-filter" className="text-sm mb-1 block">Search Items</Label>
                    <input
                      type="text"
                      id="search-filter"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by item name..."
                      className="border rounded px-3 py-2 text-sm w-64"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category-filter" className="text-sm mb-1 block">Category</Label>
                    <select
                      id="category-filter"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="discount-filter" className="text-sm mb-1 block">Discount Type</Label>
                    <select
                      id="discount-filter"
                      value={discountTypeFilter}
                      onChange={(e) => setDiscountTypeFilter(e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="all">All Discounts</option>
                      <option value="25%">25% Discount Only</option>
                      <option value="50%">50% Discount Only</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => setShowReviewOnly(!showReviewOnly)}
                      className={`border rounded px-3 py-2 text-sm font-semibold transition-colors ${
                        showReviewOnly
                          ? 'bg-yellow-600 text-white border-yellow-600 hover:bg-yellow-700'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {showReviewOnly ? '✓ ' : ''}Review Items Only
                    </button>
                  </div>

                  {(searchTerm || categoryFilter !== 'all' || discountTypeFilter !== 'all' || showReviewOnly) && (
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setCategoryFilter('all');
                          setDiscountTypeFilter('all');
                          setShowReviewOnly(false);
                        }}
                        className="border rounded px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}

                  <div className="flex items-end ml-auto">
                    <div className="text-sm text-gray-600">
                      Showing {filteredData.length} of {data.length} items
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b-2">
                      <tr>
                        <th
                          className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('itemName')}
                        >
                          <div className="flex items-center gap-1">
                            Item
                            {sortColumn === 'itemName' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('category')}
                        >
                          <div className="flex items-center gap-1">
                            Category
                            {sortColumn === 'category' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-center font-semibold bg-red-50 cursor-pointer hover:bg-red-100"
                          onClick={() => handleSort('wastageQty')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Wastage Qty
                            {sortColumn === 'wastageQty' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-right font-semibold bg-red-50 cursor-pointer hover:bg-red-100"
                          onClick={() => handleSort('wastageCost')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Wastage $
                            {sortColumn === 'wastageCost' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-center font-semibold bg-orange-50 cursor-pointer hover:bg-orange-100"
                          onClick={() => handleSort('discountQty')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Discount Qty
                            {sortColumn === 'discountQty' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-right font-semibold bg-orange-50 cursor-pointer hover:bg-orange-100"
                          onClick={() => handleSort('discountAmount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Discount $
                            {sortColumn === 'discountAmount' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-right font-semibold bg-purple-50 cursor-pointer hover:bg-purple-100"
                          onClick={() => handleSort('totalLoss')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Total Loss
                            {sortColumn === 'totalLoss' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-center font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('action')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Action
                            {sortColumn === 'action' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-center font-semibold bg-green-50">
                          <div className="flex items-center justify-center gap-1">
                            Actioned
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                clearActionedItems();
                              }}
                              className="ml-1 text-xs text-gray-500 hover:text-red-600"
                              title="Clear all actioned items"
                            >
                              ✕
                            </button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((item, index) => {
                      const highWastage = item.wastageQty > 5;
                      const highDiscount = item.discountQty > 5;
                      const criticalLoss = item.totalLoss > 50;
                      const hasAction = criticalLoss || highWastage || highDiscount;
                      const isActioned = actionedItems.has(item.itemName);

                      return (
                        <tr
                          key={index}
                          className={`border-b hover:bg-blue-50 cursor-pointer transition-colors ${
                            isActioned ? 'opacity-50 bg-gray-50' : ''
                          }`}
                          onClick={() => handleItemClick(item)}
                          title="Click to view detailed history"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.itemName}</div>
                            {item.vendorName && (
                              <div className="text-xs text-gray-500">{item.vendorName}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {item.category}
                          </td>
                          <td className={`px-3 py-2 text-center ${highWastage ? 'bg-red-100' : 'bg-red-50'}`}>
                            <span className={highWastage ? 'font-bold text-red-700' : ''}>
                              {item.wastageQty.toFixed(1)}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right ${highWastage ? 'bg-red-100' : 'bg-red-50'}`}>
                            <span className={highWastage ? 'font-bold text-red-700' : ''}>
                              ${item.wastageCost.toFixed(2)}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-center ${highDiscount ? 'bg-orange-100' : 'bg-orange-50'}`}>
                            <span className={highDiscount ? 'font-bold text-orange-700' : ''}>
                              {item.discountQty.toFixed(1)}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right ${highDiscount ? 'bg-orange-100' : 'bg-orange-50'}`}>
                            <span className={highDiscount ? 'font-bold text-orange-700' : ''}>
                              ${item.discountAmount.toFixed(2)}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${criticalLoss ? 'bg-purple-100 text-purple-700' : 'bg-purple-50'}`}>
                            ${item.totalLoss.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {criticalLoss && (
                              <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded">
                                🚨 Order Less
                              </span>
                            )}
                            {(highWastage || highDiscount) && !criticalLoss && (
                              <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded">
                                ⚠️ Review
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center bg-green-50">
                            {hasAction && (
                              <input
                                type="checkbox"
                                checked={isActioned}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleActionedItem(item.itemName);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-5 h-5 cursor-pointer accent-green-600"
                                title={isActioned ? 'Mark as not actioned' : 'Mark as actioned'}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Item History Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedItem.itemName}</h2>
                  <p className="text-purple-100 mt-1">
                    {dateRange.start} to {dateRange.end}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <div className="text-xs text-purple-100">Wastage Cost</div>
                  <div className="text-xl font-bold">${selectedItem.totals.wastageCost.toFixed(2)}</div>
                  <div className="text-xs text-purple-100">{selectedItem.totals.wastageQty.toFixed(1)} units</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <div className="text-xs text-purple-100">Discount Amount</div>
                  <div className="text-xl font-bold">${selectedItem.totals.discountAmount.toFixed(2)}</div>
                  <div className="text-xs text-purple-100">{selectedItem.totals.discountQty.toFixed(1)} units</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <div className="text-xs text-purple-100">Total Loss</div>
                  <div className="text-xl font-bold">${selectedItem.totals.totalLoss.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Wastage History */}
                <div>
                  <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center">
                    <span className="mr-2">🗑️</span>
                    Wastage History ({selectedItem.wastageHistory.length})
                  </h3>
                  {selectedItem.wastageHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm">No wastage records</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedItem.wastageHistory.map((record, idx) => (
                        <div key={idx} className="border rounded-lg p-3 bg-red-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-red-700">{record.adjustmentType}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(record.date).toLocaleDateString()}
                              </div>
                              {record.location && (
                                <div className="text-xs text-gray-500">{record.location}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-red-700">${record.cost.toFixed(2)}</div>
                              <div className="text-xs text-gray-600">{record.quantity.toFixed(1)} units</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Discount History */}
                <div>
                  <h3 className="text-lg font-bold text-orange-700 mb-3 flex items-center">
                    <span className="mr-2">💰</span>
                    Discount History ({selectedItem.discountHistory.length})
                  </h3>
                  {selectedItem.discountHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm">No discount records</p>
                  ) : (
                    <>
                      {/* Discount Type Totals */}
                      {(selectedItem.totals.discount25Percent > 0 || selectedItem.totals.discount50Percent > 0) && (
                        <div className="mb-4 pb-3 border-b border-orange-200">
                          <div className="text-sm font-semibold text-orange-800 mb-2">Discount Totals</div>
                          <div className="space-y-1">
                            {selectedItem.totals.discount25Percent > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">25% Discount:</span>
                                <span className="font-bold text-orange-700">
                                  ${selectedItem.totals.discount25Percent.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {selectedItem.totals.discount50Percent > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">50% Discount:</span>
                                <span className="font-bold text-orange-700">
                                  ${selectedItem.totals.discount50Percent.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {selectedItem.discountHistory.map((record, idx) => (
                          <div key={idx} className="border rounded-lg p-3 bg-orange-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-semibold text-orange-700">
                                  {record.discountType || 'Discount'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(record.date).toLocaleDateString()}
                                </div>
                                {record.discountPercent && (
                                  <div className="text-xs text-orange-600 font-semibold">
                                    {record.discountPercent.toFixed(0)}% off
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-orange-700">-${record.discountAmount.toFixed(2)}</div>
                                <div className="text-xs text-gray-600">{record.quantity.toFixed(1)} units</div>
                                {record.originalPrice && record.finalPrice && (
                                  <div className="text-xs text-gray-500">
                                    ${record.originalPrice.toFixed(2)} → ${record.finalPrice.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
              <Button onClick={() => setSelectedItem(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Details Modal */}
      {selectedDiscountType && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDiscountType(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedDiscountType} - All Items</h2>
                  <p className="text-blue-100 mt-1">
                    {dateRange.start} to {dateRange.end}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDiscountType(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Summary Stats */}
              {!isLoadingDetails && discountDetails.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-white bg-opacity-20 rounded-lg p-3">
                    <div className="text-xs text-blue-100">Total Discount Amount</div>
                    <div className="text-xl font-bold">
                      ${discountDetails.reduce((sum, d) => sum + d.discountAmount, 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg p-3">
                    <div className="text-xs text-blue-100">Total Transactions</div>
                    <div className="text-xl font-bold">{discountDetails.length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading discount details...</div>
                </div>
              ) : discountDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No discount records found for this type.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b-2">
                      <tr>
                        <th
                          className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleModalSort('itemName')}
                        >
                          <div className="flex items-center gap-1">
                            Item Name
                            {modalSortColumn === 'itemName' && (
                              <span className="text-xs">
                                {modalSortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleModalSort('saleDate')}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            {modalSortColumn === 'saleDate' && (
                              <span className="text-xs">
                                {modalSortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-center font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleModalSort('quantity')}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Quantity
                            {modalSortColumn === 'quantity' && (
                              <span className="text-xs">
                                {modalSortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-right font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleModalSort('discountPercent')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Discount %
                            {modalSortColumn === 'discountPercent' && (
                              <span className="text-xs">
                                {modalSortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-2 text-right font-semibold cursor-pointer hover:bg-gray-100"
                          onClick={() => handleModalSort('discountAmount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Discount $
                            {modalSortColumn === 'discountAmount' && (
                              <span className="text-xs">
                                {modalSortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDiscountDetails.map((detail, idx) => (
                        <tr key={idx} className="border-b hover:bg-blue-50">
                          <td className="px-3 py-2 font-medium">{detail.itemName}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {new Date(detail.saleDate).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-center">{detail.quantity.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right text-orange-600 font-semibold">
                            {detail.discountPercent ? `${detail.discountPercent.toFixed(0)}%` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-orange-700">
                            ${detail.discountAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-right font-bold">Total:</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-right font-bold text-indigo-700 text-lg">
                          ${discountDetails.reduce((sum, d) => sum + d.discountAmount, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
              <Button onClick={() => setSelectedDiscountType(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
