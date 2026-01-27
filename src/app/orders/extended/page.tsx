'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

const SHELF_LOCATIONS = [
  'Ice Cream Freezer',
  'Home and Cleaning',
  'Baking and Cooking',
  'Coffee Machine',
  'Food Fridge',
  'Supplements Fridge',
  'Confectionary',
  'Weleda',
  'Coffee Retail',
  'Supplements',
  'Groceries',
  'Supplements Side',
  'Crackers',
  'Calendars',
  'Baby',
  'Alt Milks',
  'House and Oils',
  'Mushrooms',
  'House and Teeth',
  'Dried Fruit Packs',
  'Nut Blue Shelf',
  'Supps Fridge',
  'Fruit and Veg',
  'Supplements Back',
  'Drink Fridge',
  'Cereals and Pasta',
  'Tins',
  'Bread',
  'Tea',
  'Chips',
  'Tofu Fridge',
  'International Groceries',
  'Fresh Bread',
  'Soap',
  'Chai and Tea and Coffee',
  'Cooking Oils',
  'Supplements Counter',
  'Pasta',
  'Choc and Confectionary',
  'Incense',
  'Under Counter',
  'Front Counter',
  'Counter',
  'Dairy Fridge',
  'Candles',
  'Cosmetics',
  'Incense Swivel',
  'Freezer',
  'Drinks Fridge',
];

interface OrderItem {
  itemId?: string; // Database item ID for linking
  itemName: string;
  vendorName: string;
  category: string;
  subcategory?: string;
  sku?: string; // Product Vendor Code
  weeks: number[];
  totalUnits: number;
  avgWeekly: number;
  sellPrice: number;
  costPrice?: number;
  margin?: number;
  marginPercent?: number;
  currentStock?: number;
  suggestedOrder: number;
  orderQuantity?: number; // User's entered order quantity
  packSize?: number; // Minimum pack size requirement (6, 12, or 24)
}

interface SavedAnalysis {
  timestamp: string;
  vendorName: string;
  orderFrequency: number;
  weeksAnalyzed: number;
  items: OrderItem[];
}

export default function OrdersPage() {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [csvVendors, setCsvVendors] = useState<string[]>([]); // Vendors from CSV data
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [orderFrequency, setOrderFrequency] = useState<number>(1);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [shelfFilter, setShelfFilter] = useState('');
  const [sortField, setSortField] = useState<string>('avgWeekly');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showPrintView, setShowPrintView] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  
  // Square Data source state
  const [dataSource, setDataSource] = useState<'square' | 'csv'>('square');
  const [squareVendor, setSquareVendor] = useState<string>('');
  const [squareWeeks, setSquareWeeks] = useState<number>(12);
  const [squareOrderFrequency, setSquareOrderFrequency] = useState<number>(1);
  const [isSquareAnalyzing, setIsSquareAnalyzing] = useState(false);
  const [availableItemsTotal, setAvailableItemsTotal] = useState(0);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemVendorFilter, setItemVendorFilter] = useState('');

  useEffect(() => {
    loadVendors();
  }, []);

  // Trigger server-side search when search term or vendor filter changes
  useEffect(() => {
    if (showAddItemsModal) {
      const delaySearch = setTimeout(() => {
        loadAvailableItems(itemSearchTerm, itemVendorFilter);
      }, 300); // Debounce search by 300ms

      return () => clearTimeout(delaySearch);
    }
  }, [itemSearchTerm, itemVendorFilter, showAddItemsModal]);

  const loadVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      const data = await response.json();
      // API returns array directly, not wrapped in success/data structure
      if (Array.isArray(data)) {
        setVendors(data);
      } else {
        console.error('Unexpected vendors response format:', data);
      }
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadAvailableItems = async (searchTerm = '', vendorFilter = '') => {
    setIsLoadingItems(true);
    try {
      // Build query parameters for server-side search
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // High limit to ensure all items are searchable
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (vendorFilter) {
        params.append('vendorId', vendorFilter);
      }

      const response = await fetch(`/api/items?${params.toString()}`);
      const data = await response.json();
      console.log('API Response:', data);
      console.log('Items data:', data.data);
      if (data.success) {
        const items = data.data.data || [];
        const total = data.data.pagination?.totalCount || items.length;
        console.log('Setting available items:', items.length, 'items of', total, 'total');
        setAvailableItems(items);
        setAvailableItemsTotal(total);
      } else {
        console.error('API returned error:', data);
        const errorMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || 'Failed to load items';
        toast.error('Error', errorMsg);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('Error', 'Failed to load items from database');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleAddItemsClick = () => {
    setShowAddItemsModal(true);
    // loadAvailableItems will be called by the useEffect when modal opens
  };

  const handleAddItemToOrder = (dbItem: any) => {
    // Check if item already exists in order
    const existingItem = items.find(item => item.itemName === dbItem.name);
    if (existingItem) {
      toast.error('Info', 'Item already in order list');
      return;
    }

    // Create new order item from database item
    // Convert Decimal objects to numbers
    const costExGst = Number(dbItem.currentCostExGst) || 0;
    const sellIncGst = Number(dbItem.currentSellIncGst) || 0;
    const costIncGst = costExGst * 1.1; // Add GST to cost
    const margin = sellIncGst - costIncGst;
    const marginPercent = sellIncGst > 0 ? (margin / sellIncGst) * 100 : 0;

    const newOrderItem: OrderItem = {
      itemId: dbItem.id, // Link to database item
      itemName: dbItem.name,
      vendorName: dbItem.vendor?.name || 'Unknown Vendor',
      category: dbItem.category || 'Uncategorized',
      subcategory: dbItem.subcategory || '',
      sku: dbItem.sku || '',
      weeks: Array(files.length || 6).fill(0), // Fill with zeros for weeks
      totalUnits: 0,
      avgWeekly: 0,
      sellPrice: sellIncGst,
      costPrice: costExGst,
      margin: margin,
      marginPercent: marginPercent,
      currentStock: dbItem.inventoryItem?.currentStock || 0,
      suggestedOrder: 0, // User can set this manually
      orderQuantity: 0,
      packSize: undefined,
    };

    setItems([...items, newOrderItem]);
    toast.success('Success', `Added ${dbItem.name} to order`);
  };

  const handleRemoveItem = (itemName: string) => {
    setItems(items.filter(item => item.itemName !== itemName));
    toast.success('Success', 'Item removed from order');
  };

  const handleAddAllFromVendor = () => {
    if (!itemVendorFilter) {
      toast.error('Error', 'Please select a vendor first');
      return;
    }

    // Filter out items that are already in the order
    const newItems: OrderItem[] = [];
    let skippedCount = 0;

    for (const dbItem of availableItems) {
      // Check if item already exists in order
      const existingItem = items.find(item => item.itemName === dbItem.name);
      if (existingItem) {
        skippedCount++;
        continue;
      }

      // Create new order item from database item
      const costExGst = Number(dbItem.currentCostExGst) || 0;
      const sellIncGst = Number(dbItem.currentSellIncGst) || 0;
      const costIncGst = costExGst * 1.1;
      const margin = sellIncGst - costIncGst;
      const marginPercent = sellIncGst > 0 ? (margin / sellIncGst) * 100 : 0;

      newItems.push({
        itemId: dbItem.id,
        itemName: dbItem.name,
        vendorName: dbItem.vendor?.name || 'Unknown Vendor',
        category: dbItem.category || 'Uncategorized',
        subcategory: dbItem.subcategory || '',
        sku: dbItem.sku || '',
        weeks: Array(files.length || 6).fill(0),
        totalUnits: 0,
        avgWeekly: 0,
        sellPrice: sellIncGst,
        costPrice: costExGst,
        margin: margin,
        marginPercent: marginPercent,
        currentStock: dbItem.inventoryItem?.currentStock || 0,
        suggestedOrder: 0,
        orderQuantity: 0,
        packSize: undefined,
      });
    }

    if (newItems.length > 0) {
      setItems([...items, ...newItems]);
      const vendorName = vendors.find(v => v.id === itemVendorFilter)?.name || 'vendor';
      toast.success('Success', `Added ${newItems.length} item${newItems.length !== 1 ? 's' : ''} from ${vendorName}${skippedCount > 0 ? ` (${skippedCount} already in list)` : ''}`);
    } else {
      toast.error('Info', 'All items from this vendor are already in the order list');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setItems([]); // Clear previous analysis
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error('Error', 'Please select at least one CSV file');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('file', file));
      if (selectedVendor) formData.append('vendorId', selectedVendor);
      formData.append('orderFrequency', orderFrequency.toString());

      const response = await fetch('/api/orders/analyze-sales', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const analyzedItems = data.data.items.map((item: OrderItem) => ({
          ...item,
          orderQuantity: 0, // Initialize empty - user fills in order quantities
          packSize: undefined, // Initialize with no pack size requirement
        }));
        setItems(analyzedItems);

        // Extract unique vendor names from the data
        const uniqueVendors = Array.from(new Set(analyzedItems.map((item: OrderItem) => item.vendorName))).filter(Boolean);
        setCsvVendors(uniqueVendors);

        // If only one vendor, auto-select it
        if (uniqueVendors.length === 1 && !selectedVendor) {
          setSelectedVendor(uniqueVendors[0]);
        }

        toast.success('Success', `Analyzed ${data.data.summary.totalItems} items across ${data.data.summary.weeksAnalyzed} weeks`);
      } else {
        toast.error('Error', data.error?.message || 'Failed to analyze sales data');
      }
    } catch (error) {
      toast.error('Error', 'Failed to analyze sales data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSquareAnalyze = async () => {
    setIsSquareAnalyzing(true);
    try {
      const params = new URLSearchParams({
        weeks: squareWeeks.toString(),
        orderFrequency: squareOrderFrequency.toString(),
      });
      if (squareVendor) {
        params.append('vendor', squareVendor);
      }

      const response = await fetch(`/api/square/sales-analysis?${params.toString()}`);
      const data = await response.json();

      if (data.success || data.data) {
        const analyzedItems = (data.data?.items || []).map((item: OrderItem) => ({
          ...item,
          orderQuantity: 0,
          packSize: undefined,
        }));
        setItems(analyzedItems);

        // Sync order frequency to the shared state
        setOrderFrequency(squareOrderFrequency);

        // Extract unique vendor names
        const uniqueVendors: string[] = Array.from(new Set(analyzedItems.map((item: OrderItem) => item.vendorName))).filter(Boolean) as string[];
        setCsvVendors(uniqueVendors);

        // If only one vendor, auto-select it
        if (uniqueVendors.length === 1 && !selectedVendor) {
          setSelectedVendor(uniqueVendors[0] as string);
        }

        const summary = data.data?.summary;
        toast.success('Success', `Loaded ${analyzedItems.length} items from Square data${summary ? ` (${summary.weeksAnalyzed} weeks)` : ''}`);
      } else {
        toast.error('Error', data.error?.message || 'Failed to load Square sales data');
      }
    } catch (error) {
      toast.error('Error', 'Failed to load Square sales data');
    } finally {
      setIsSquareAnalyzing(false);
    }
  };

  // Helper function to round up to nearest pack size
  const roundToPackSize = (quantity: number, packSize?: number): number => {
    if (!packSize || packSize <= 0 || quantity <= 0) {
      return quantity;
    }
    return Math.ceil(quantity / packSize) * packSize;
  };

  const handleOrderQuantityChange = (itemName: string, value: string) => {
    const rawQuantity = parseInt(value) || 0;

    const newItems = items.map(item => {
      if (item.itemName === itemName) {
        // Apply pack size rounding if pack size is set
        return {
          ...item,
          orderQuantity: roundToPackSize(rawQuantity, item.packSize)
        };
      }
      return item;
    });

    setItems(newItems);
  };

  const handlePackSizeChange = (itemName: string, packSize: string) => {
    const packSizeNum = packSize === '' ? undefined : parseInt(packSize);

    const newItems = items.map(item => {
      if (item.itemName === itemName) {
        // Recalculate order quantity with new pack size
        const orderQuantity = item.orderQuantity
          ? roundToPackSize(item.orderQuantity, packSizeNum)
          : item.orderQuantity;

        return {
          ...item,
          packSize: packSizeNum,
          orderQuantity
        };
      }
      return item;
    });

    setItems(newItems);
  };

  const handleStockUpdate = async (itemName: string, newStock: number) => {
    // Update local state immediately for responsive UI
    const newItems = items.map(item =>
      item.itemName === itemName
        ? {
            ...item,
            currentStock: newStock,
            // Recalculate suggested order with new stock
            suggestedOrder: Math.max(0, Math.ceil(item.avgWeekly * orderFrequency) - newStock)
          }
        : item
    );
    setItems(newItems);

    // Update database in background
    try {
      // Find the item in database by name to get its ID
      const response = await fetch(`/api/items?name=${encodeURIComponent(itemName)}`);
      const data = await response.json();

      if (data.success && data.data.data.length > 0) {
        const dbItem = data.data.data[0];

        // Update inventory stock
        await fetch(`/api/inventory/${dbItem.id}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentStock: newStock }),
        });
      }
    } catch (error) {
      console.error('Failed to update stock:', error);
      toast.error('Warning', 'Stock updated locally but failed to save to database');
    }
  };

  const handleOrderFrequencyChange = (newFrequency: number) => {
    setOrderFrequency(newFrequency);

    // Recalculate suggested orders for all items based on new frequency
    if (items.length > 0) {
      const updatedItems = items.map(item => {
        const currentStock = item.currentStock || 0;
        const baseSuggestedOrder = Math.max(
          0,
          Math.ceil(item.avgWeekly * newFrequency) - currentStock
        );

        // Apply pack size rounding to suggested order
        const suggestedOrder = roundToPackSize(baseSuggestedOrder, item.packSize);

        return {
          ...item,
          suggestedOrder,
          orderQuantity: suggestedOrder, // Update order quantity to match new suggestion
        };
      });
      setItems(updatedItems);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 100);
  };

  const handleRemoveEmptyOrders = () => {
    const itemsWithOrders = items.filter(item => item.orderQuantity > 0);
    setItems(itemsWithOrders);
    toast.success('Removed items', `Removed ${items.length - itemsWithOrders.length} items without order quantities`);
  };

  const getRowColorClass = (item: OrderItem) => {
    // High sellers (top 20% by avg weekly) - Green
    const avgThreshold = items.length > 0
      ? items.sort((a, b) => b.avgWeekly - a.avgWeekly)[Math.floor(items.length * 0.2)]?.avgWeekly || 5
      : 5;

    if (item.avgWeekly >= avgThreshold) {
      return 'bg-green-50 border-l-4 border-green-500';
    }

    // Low sellers (avg < 0.3/week) - Red (consider cutting)
    if (item.avgWeekly < 0.3) {
      return 'bg-red-50 border-l-4 border-red-500';
    }

    // Medium sellers - Yellow
    if (item.avgWeekly < 2) {
      return 'bg-yellow-50 border-l-4 border-yellow-500';
    }

    return '';
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      toast.error('Error', 'No data to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Item',
      'Vendor',
      'Category',
      'Shelf Location',
      ...items[0].weeks.map((_, i) => `WK${i + 1}`),
      'Total',
      'Avg/Week',
      'Performance',
      'Price',
      'Cost',
      'Margin $',
      'Margin %',
      'On Hand',
      'Suggested',
      'Pack Size',
      'Order Qty',
    ].join(',');

    const getPerformanceLabel = (item: OrderItem) => {
      const avgThreshold = items.sort((a, b) => b.avgWeekly - a.avgWeekly)[Math.floor(items.length * 0.2)]?.avgWeekly || 5;
      if (item.avgWeekly >= avgThreshold) return 'HIGH';
      if (item.avgWeekly < 0.3) return 'LOW';
      if (item.avgWeekly < 2) return 'MEDIUM';
      return 'NORMAL';
    };

    const rows = items
      .filter(item => item.orderQuantity && item.orderQuantity > 0)
      .map(item =>
        [
          `"${item.itemName}"`,
          `"${item.vendorName}"`,
          item.category,
          item.subcategory || '',
          ...item.weeks,
          item.totalUnits,
          item.avgWeekly,
          getPerformanceLabel(item),
          item.sellPrice.toFixed(2),
          item.costPrice?.toFixed(2) || '',
          item.margin?.toFixed(2) || '',
          item.marginPercent?.toFixed(1) || '',
          item.currentStock || 0,
          item.suggestedOrder,
          item.packSize || '',
          item.orderQuantity,
        ].join(',')
      );

    const csv = [headers, ...rows].join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${selectedVendor || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Success', 'Order exported to CSV');
  };

  const handleSaveAnalysis = () => {
    if (items.length === 0) {
      toast.error('Error', 'No analysis to save');
      return;
    }

    const analysis: SavedAnalysis = {
      timestamp: new Date().toISOString(),
      vendorName: selectedVendor,
      orderFrequency,
      weeksAnalyzed: files.length,
      items,
    };

    try {
      localStorage.setItem('saved_order_analysis_extended', JSON.stringify(analysis));
      toast.success('Success', 'Analysis saved successfully');
    } catch (error) {
      toast.error('Error', 'Failed to save analysis');
    }
  };

  const handleLoadAnalysis = () => {
    try {
      const saved = localStorage.getItem('saved_order_analysis_extended');
      if (!saved) {
        toast.error('Error', 'No saved analysis found');
        return;
      }

      const analysis: SavedAnalysis = JSON.parse(saved);
      setItems(analysis.items);
      setSelectedVendor(analysis.vendorName);
      setOrderFrequency(analysis.orderFrequency);

      // Extract vendors from loaded items
      const uniqueVendors = Array.from(new Set(analysis.items.map(item => item.vendorName))).filter(Boolean);
      setCsvVendors(uniqueVendors);

      toast.success('Success', `Loaded analysis from ${new Date(analysis.timestamp).toLocaleString()}`);
    } catch (error) {
      toast.error('Error', 'Failed to load analysis');
    }
  };

  const handleCreatePurchaseOrder = async () => {
    if (items.length === 0) {
      toast.error('Error', 'No items to order');
      return;
    }

    if (!selectedVendor) {
      toast.error('Error', 'Please select a specific vendor to create a purchase order');
      return;
    }

    // Get items with order quantity > 0
    const itemsToOrder = items.filter(item => item.orderQuantity && item.orderQuantity > 0);

    if (itemsToOrder.length === 0) {
      toast.error('Error', 'No items with order quantities. Please set order quantities first.');
      return;
    }

    try {
      setIsAnalyzing(true);

      // Find or create the vendor
      let vendor = vendors.find(v => v.name === selectedVendor);

      if (!vendor) {
        // Vendor doesn't exist in database, create it
        const vendorResponse = await fetch('/api/vendors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: selectedVendor,
            contactInfo: {},
          }),
        });

        if (vendorResponse.ok) {
          vendor = await vendorResponse.json();
          toast.success('Info', `Created new vendor: ${selectedVendor}`);
        } else {
          toast.error('Error', 'Failed to create vendor');
          return;
        }
      }

      // Prepare line items - filter out items without cost prices or zero quantities
      const lineItems = itemsToOrder
        .filter(item => {
          const hasValidCostPrice = item.costPrice && item.costPrice > 0;
          const hasValidQuantity = item.orderQuantity && item.orderQuantity > 0;
          return hasValidCostPrice && hasValidQuantity;
        })
        .map(item => ({
          itemId: item.itemId, // Link to database item for SKU lookup
          name: item.itemName,
          quantity: item.orderQuantity!,
          unitCostExGst: item.costPrice!,
          notes: `Avg Weekly Sales: ${item.avgWeekly} | 6-Week Total: ${item.totalUnits}`,
        }));

      if (lineItems.length === 0) {
        toast.error('Error', 'No items have both cost prices and order quantities greater than zero. Please add items to order first.');
        return;
      }

      const skippedItems = itemsToOrder.length - lineItems.length;
      if (skippedItems > 0) {
        toast.warning('Warning', `${skippedItems} item(s) skipped due to missing cost prices or zero order quantities`);
      }

      // Create purchase order
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: vendor.id,
          lineItems,
          notes: `Created from extended sales analysis (${files.length} weeks analyzed). Order frequency: ${
            orderFrequency === 0.5 ? 'Semi-weekly (Twice per week)' :
            orderFrequency === 1 ? 'Weekly' :
            orderFrequency === 2 ? 'Bi-weekly' :
            orderFrequency === 3 ? '3 Weeks' :
            orderFrequency === 4 ? 'Monthly' :
            orderFrequency === 6 ? '6 Weeks' :
            orderFrequency === 8 ? '8 Weeks' :
            orderFrequency === 12 ? '12 Weeks (Quarterly)' :
            orderFrequency === 26 ? '26 Weeks (6 Months)' :
            `Every ${orderFrequency} weeks`
          }`,
          createdBy: 'system',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Success', `Purchase order ${data.orderNumber} created successfully!`);
        // Navigate to the purchase order page
        window.location.href = `/ordering/purchase-orders`;
      } else {
        console.error('Purchase order creation error:', data);
        const errorMsg = data.details
          ? `Validation error: ${JSON.stringify(data.details)}`
          : data.error || 'Failed to create purchase order';
        toast.error('Error', errorMsg);
      }
    } catch (error) {
      console.error('Failed to create purchase order:', error);
      toast.error('Error', 'Failed to create purchase order');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter and sort items
  const filteredAndSortedItems = items
    .filter(item => {
      const matchesSearch = searchTerm === '' ||
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
      const matchesShelf = shelfFilter === '' ||
        (shelfFilter === 'Unlabelled' ? !item.subcategory || item.subcategory === '' : item.subcategory === shelfFilter);
      return matchesSearch && matchesCategory && matchesShelf;
    })
    .sort((a, b) => {
      let aVal: any = a[sortField as keyof OrderItem];
      let bVal: any = b[sortField as keyof OrderItem];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const categories = Array.from(new Set(items.map(item => item.category))).sort();

  // Use actual shelf labels (subcategories) from the data
  // Include "Unlabelled" for items without a subcategory
  const shelvesSet = new Set(items.map(item => item.subcategory || 'Unlabelled'));
  const shelves = Array.from(shelvesSet).sort();

  const summary = {
    totalItems: filteredAndSortedItems.length,
    totalOrderUnits: filteredAndSortedItems.reduce((sum, item) => sum + (item.orderQuantity || 0), 0),
    totalValue: filteredAndSortedItems.reduce(
      (sum, item) => sum + (item.orderQuantity || 0) * (item.costPrice || 0),
      0
    ),
    highPerformers: filteredAndSortedItems.filter(item => {
      const avgThreshold = items.sort((a, b) => b.avgWeekly - a.avgWeekly)[Math.floor(items.length * 0.2)]?.avgWeekly || 5;
      return item.avgWeekly >= avgThreshold;
    }).length,
    lowPerformers: filteredAndSortedItems.filter(item => item.avgWeekly < 0.3).length,
  };

  // Sort items for print view - by shelf/subcategory, then by category, then by item name
  const printSortedItems = [...items]
    .filter(item => {
      const matchesSearch = searchTerm === '' ||
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
      const matchesShelf = shelfFilter === '' ||
        (shelfFilter === 'Unlabelled' ? !item.subcategory || item.subcategory === '' : item.subcategory === shelfFilter);
      return matchesSearch && matchesCategory && matchesShelf;
    })
    .sort((a, b) => {
      // First sort by subcategory/shelf location
      const shelfA = a.subcategory || 'Unlabelled';
      const shelfB = b.subcategory || 'Unlabelled';

      if (shelfA !== shelfB) {
        // Use shelf location order from SHELF_LOCATIONS array
        const indexA = SHELF_LOCATIONS.indexOf(shelfA);
        const indexB = SHELF_LOCATIONS.indexOf(shelfB);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return shelfA.localeCompare(shelfB);
      }

      // Then by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }

      // Finally by item name
      return a.itemName.localeCompare(b.itemName);
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Form - 6 Month Sales Analysis (Up to 26 Weeks)</h1>
            <p className="text-gray-600">Extended analysis for long-term sales trends and purchase orders</p>
          </div>
          <div className="flex gap-2">
            <Link href="/orders">
              <Button variant="outline" className="bg-blue-50 hover:bg-blue-100 text-blue-700">
                ← Back to 6 Week Analysis
              </Button>
            </Link>
            <Link href="/items">
              <Button variant="secondary">Back to Items</Button>
            </Link>
          </div>
        </div>

        {/* Data Source & Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sales Data</CardTitle>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  onClick={() => setDataSource('square')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    dataSource === 'square'
                      ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ⬛ Square Data
                </button>
                <button
                  onClick={() => setDataSource('csv')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    dataSource === 'csv'
                      ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📄 CSV Upload
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {dataSource === 'square' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="square-vendor-select">Select Vendor</Label>
                    <select
                      id="square-vendor-select"
                      value={squareVendor}
                      onChange={(e) => setSquareVendor(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="">All Vendors</option>
                      {vendors.map(vendor => (
                        <option key={vendor.id} value={vendor.name}>{vendor.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="square-weeks">Weeks to Analyze</Label>
                    <select
                      id="square-weeks"
                      value={squareWeeks}
                      onChange={(e) => setSquareWeeks(parseInt(e.target.value))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="4">4 weeks</option>
                      <option value="6">6 weeks</option>
                      <option value="8">8 weeks</option>
                      <option value="12">12 weeks</option>
                      <option value="26">26 weeks (6 months)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="square-order-frequency">Order Frequency</Label>
                    <select
                      id="square-order-frequency"
                      value={squareOrderFrequency}
                      onChange={(e) => setSquareOrderFrequency(parseFloat(e.target.value))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="0.5">Semi-weekly (Twice per week)</option>
                      <option value="1">Weekly</option>
                      <option value="2">Bi-weekly (Every 2 weeks)</option>
                      <option value="3">3 Weeks</option>
                      <option value="4">Monthly (Every 4 weeks)</option>
                      <option value="6">6 Weeks</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSquareAnalyze} disabled={isSquareAnalyzing}>
                    {isSquareAnalyzing ? 'Analyzing...' : 'Analyze Square Sales'}
                  </Button>
                  <Button onClick={handleLoadAnalysis} variant="secondary" className="bg-purple-50 hover:bg-purple-100 text-purple-700">
                    📂 Load Saved Analysis
                  </Button>
                  <div className="ml-auto">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800 font-medium">💡 Data pulled directly from Square POS</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="vendor-select">Select Vendor{csvVendors.length > 0 ? ' (from analysis)' : ' (optional)'}</Label>
                    <select
                      id="vendor-select"
                      value={selectedVendor}
                      onChange={(e) => setSelectedVendor(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="">All Vendors</option>
                      {csvVendors.length > 0 ? (
                        <>
                          {csvVendors.map(vendorName => (
                            <option key={vendorName} value={vendorName}>{vendorName}</option>
                          ))}
                        </>
                      ) : (
                        <>
                          {vendors.map(vendor => (
                            <option key={vendor.id} value={vendor.name}>{vendor.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="order-frequency">Order Frequency</Label>
                    <select
                      id="order-frequency"
                      value={orderFrequency}
                      onChange={(e) => handleOrderFrequencyChange(parseFloat(e.target.value))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="0.5">Semi-weekly (Twice per week)</option>
                      <option value="1">Weekly</option>
                      <option value="2">Bi-weekly (Every 2 weeks)</option>
                      <option value="3">3 Weeks</option>
                      <option value="4">Monthly (Every 4 weeks)</option>
                      <option value="6">6 Weeks</option>
                      <option value="8">8 Weeks</option>
                      <option value="12">12 Weeks (Quarterly)</option>
                      <option value="26">26 Weeks (6 Months)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <div className="w-full">
                      <Label htmlFor="csv-upload">Upload Vendor Sales CSV Files (1-26 weeks)</Label>
                      <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        multiple
                        onChange={handleFileSelect}
                        className="mt-1 block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <div className="w-full">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800 font-medium mb-1">💡 Cost prices & shelf labels from database</p>
                        <p className="text-xs text-blue-600">
                          Update your Square MPL via <Link href="/items" className="underline font-semibold">Items page</Link> to keep product costs and shelf locations current
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Or load a previously saved analysis</p>
                      <Button onClick={handleLoadAnalysis} variant="secondary" className="bg-purple-50 hover:bg-purple-100 text-purple-700">
                        📂 Load Saved Analysis
                      </Button>
                    </div>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                    <span className="text-sm text-blue-800">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected: {files.map(f => f.name).join(', ')}
                    </span>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                      {isAnalyzing ? 'Analyzing...' : `Analyze ${files.length} Week${files.length !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {items.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-gray-500">Total Items</div>
                  <div className="text-2xl font-bold text-gray-900">{summary.totalItems}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-gray-500">Total Order Units</div>
                  <div className="text-2xl font-bold text-gray-900">{summary.totalOrderUnits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-gray-500">Order Value</div>
                  <div className="text-2xl font-bold text-gray-900">${summary.totalValue.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-green-700">High Performers</div>
                  <div className="text-2xl font-bold text-green-900">{summary.highPerformers}</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50">
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-red-700">Low Performers</div>
                  <div className="text-2xl font-bold text-red-900">{summary.lowPerformers}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex space-x-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={shelfFilter}
                  onChange={(e) => setShelfFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Shelves</option>
                  {shelves.map(shelf => (
                    <option key={shelf} value={shelf}>{shelf}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-2 flex-wrap gap-2">
                <Button
                  onClick={handleAddItemsClick}
                  variant="secondary"
                  className="bg-orange-50 hover:bg-orange-100 text-orange-700"
                >
                  ➕ Add Items Not in Sales
                </Button>
                <Button
                  onClick={handleRemoveEmptyOrders}
                  variant="secondary"
                  className="bg-red-50 hover:bg-red-100 text-red-700"
                  disabled={items.length === 0}
                >
                  🗑️ Remove Empty Orders
                </Button>
                <Button
                  onClick={handleCreatePurchaseOrder}
                  disabled={!selectedVendor || isAnalyzing}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isAnalyzing ? 'Creating...' : '📋 Create Purchase Order'}
                </Button>
                <Button onClick={handleSaveAnalysis} variant="secondary" className="bg-purple-50 hover:bg-purple-100 text-purple-700">
                  💾 Save Analysis
                </Button>
                <Button onClick={handleLoadAnalysis} variant="secondary" className="bg-purple-50 hover:bg-purple-100 text-purple-700">
                  📂 Load Analysis
                </Button>
                <Button onClick={handlePrint} variant="secondary" className="bg-green-50 hover:bg-green-100 text-green-700">
                  🖨️ Print Order Sheet
                </Button>
                <Button onClick={handleExportCSV} variant="secondary">
                  📤 Export CSV
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-4 text-sm p-3 bg-gray-50 rounded">
              <span className="font-semibold">Performance:</span>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>High Sellers (Top 20%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Medium (1-2/wk)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Low (&lt;0.3/wk) - Consider Cutting</span>
              </div>
            </div>

            {/* Order Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th
                          className="px-2 py-1 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('itemName')}
                        >
                          Item {sortField === 'itemName' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-1 py-1 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('category')}
                        >
                          Cat. {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-1 py-1 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('subcategory')}
                          title="Shelf Label"
                        >
                          🏷️ {sortField === 'subcategory' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-1 py-1 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('sku')}
                          title="Vendor Code"
                        >
                          #️⃣ {sortField === 'sku' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        {items[0].weeks.map((_, i) => (
                          <th key={i} className="px-1 py-1 text-center font-semibold text-gray-700 bg-blue-50">
                            WK{i + 1}
                          </th>
                        ))}
                        <th
                          className="px-1 py-1 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('totalUnits')}
                        >
                          Total {sortField === 'totalUnits' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-1 py-1 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('avgWeekly')}
                        >
                          Avg/Wk {sortField === 'avgWeekly' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-1 py-1 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('costPrice')}
                        >
                          Cost {sortField === 'costPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-1 py-1 text-right font-semibold text-gray-700">Price</th>
                        <th
                          className="px-1 py-1 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('margin')}
                        >
                          Margin {sortField === 'margin' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-1 py-1 text-center font-semibold text-gray-700">On Hand</th>
                        <th className="px-1 py-1 text-center font-semibold text-gray-700 bg-yellow-50">Suggest</th>
                        <th className="px-1 py-1 text-center font-semibold text-gray-700 bg-purple-50">Pack Size</th>
                        <th className="px-1 py-1 text-center font-semibold text-gray-700 bg-green-50">Order</th>
                        <th className="px-1 py-1 text-center font-semibold text-gray-700">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedItems.map((item, index) => (
                        <tr key={index} className={`border-b border-gray-100 hover:bg-opacity-75 ${getRowColorClass(item)}`}>
                          <td className="px-2 py-1">
                            <div className="font-medium text-gray-900">{item.itemName}</div>
                          </td>
                          <td className="px-1 py-1 text-gray-600 text-xs max-w-[80px] truncate" title={item.category}>{item.category}</td>
                          <td className="px-1 py-1 text-center text-gray-600" title={item.subcategory || 'No shelf label'}>
                            {item.subcategory ? '✓' : '-'}
                          </td>
                          <td className="px-1 py-1 text-center text-gray-500" title={item.sku || 'No Vendor Code'}>
                            {item.sku ? '✓' : '-'}
                          </td>
                          {item.weeks.map((units, weekIndex) => (
                            <td
                              key={weekIndex}
                              className="px-1 py-1 text-center font-medium text-blue-700"
                            >
                              {units}
                            </td>
                          ))}
                          <td className="px-1 py-1 text-center font-semibold">{item.totalUnits}</td>
                          <td className="px-1 py-1 text-center font-semibold text-gray-700">
                            {item.avgWeekly}
                          </td>
                          <td className="px-1 py-1 text-right text-gray-600">
                            {item.costPrice ? `$${item.costPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-1 py-1 text-right">${item.sellPrice.toFixed(2)}</td>
                          <td className="px-1 py-1 text-right">
                            {item.margin !== undefined ? (
                              <span className="font-medium text-gray-900">${item.margin.toFixed(2)}</span>
                            ) : '-'}
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="number"
                              value={item.currentStock || 0}
                              onChange={(e) => handleStockUpdate(item.itemName, parseFloat(e.target.value) || 0)}
                              className="w-16 px-1 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="1"
                            />
                          </td>
                          <td className="px-1 py-1 text-center bg-yellow-50 font-semibold">
                            {item.suggestedOrder}
                          </td>
                          <td className="px-1 py-1 bg-purple-50">
                            <div className="flex flex-col items-center space-y-1">
                              {item.packSize && (
                                <div className="text-lg font-bold text-purple-700">
                                  {item.packSize}
                                </div>
                              )}
                              <select
                                value={item.packSize || ''}
                                onChange={(e) => handlePackSizeChange(item.itemName, e.target.value)}
                                className="w-full px-1 py-1 text-center border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                              >
                                <option value="">None</option>
                                <option value="6">6</option>
                                <option value="12">12</option>
                                <option value="24">24</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-1 py-1 bg-green-50">
                            <input
                              type="number"
                              value={item.orderQuantity || 0}
                              onChange={(e) => handleOrderQuantityChange(item.itemName, e.target.value)}
                              className="w-20 px-1 py-1 text-center border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                              min="0"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.itemName)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-2 py-1 transition-colors"
                              title="Remove item from order"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
              <p>Upload 1-26 weeks of Square vendor sales CSV files to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Add Items Modal */}
        {showAddItemsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Add Items to Order</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Search and add items from your database that weren't in the sales reports
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddItemsModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="item-search">Search Items</Label>
                    <input
                      id="item-search"
                      type="text"
                      placeholder="Search by name, Vendor Code..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-vendor-filter">Filter by Vendor</Label>
                    <select
                      id="item-vendor-filter"
                      value={itemVendorFilter}
                      onChange={(e) => setItemVendorFilter(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Vendors</option>
                      {vendors.map(vendor => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Add All Button */}
                {itemVendorFilter && (
                  <div className="mt-4">
                    <Button
                      onClick={handleAddAllFromVendor}
                      className="bg-green-600 hover:bg-green-700 text-white w-full"
                      disabled={isLoadingItems || availableItems.length === 0}
                    >
                      ➕ Add All {availableItems.length} Item{availableItems.length !== 1 ? 's' : ''} from {vendors.find(v => v.id === itemVendorFilter)?.name || 'Vendor'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingItems ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500">Loading items...</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableItems
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-600 space-x-3">
                              {item.vendor && (
                                <span>Vendor: {item.vendor.name}</span>
                              )}
                              {item.sku && (
                                <span>Vendor Code: {item.sku}</span>
                              )}
                              {item.category && (
                                <span>Category: {item.category}</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 space-x-3 mt-1">
                              {item.currentCostExGst && (
                                <span>Cost: ${Number(item.currentCostExGst).toFixed(2)}</span>
                              )}
                              {item.currentSellIncGst && (
                                <span>Sell: ${Number(item.currentSellIncGst).toFixed(2)}</span>
                              )}
                              {item.inventoryItem && (
                                <span>Stock: {item.inventoryItem.currentStock || 0}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAddItemToOrder(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            Add to Order
                          </Button>
                        </div>
                      ))}
                    {availableItems.length === 0 && !isLoadingItems && (
                      <div className="text-center py-12 text-gray-500">
                        No items found matching your search
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Showing {availableItems.length} of {availableItemsTotal} item{availableItemsTotal !== 1 ? 's' : ''}
                    {availableItems.length < availableItemsTotal && (
                      <span className="text-orange-600 ml-2">
                        (Use search to find more items)
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowAddItemsModal(false)}
                    variant="secondary"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print View */}
        {showPrintView && (
          <div className="print-view fixed inset-0 bg-white z-50 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">WILD OCTAVE ORGANICS - ORDER FORM</h1>
              <p className="text-sm mt-2">
                <strong>Vendor:</strong> {selectedVendor || 'All Vendors'} | <strong>Date:</strong> {new Date().toLocaleDateString('en-AU')} | <strong>Weeks Analyzed:</strong> {files.length}
              </p>
            </div>

            {/* Group by shelf location for easy checking - continuous flow with gaps */}
            {shelves.length > 0 ? (
              <div>
                {shelves.map((shelf, shelfIndex) => {
                  const shelfItems = printSortedItems.filter(item =>
                    shelf === 'Unlabelled'
                      ? !item.subcategory || item.subcategory === ''
                      : item.subcategory === shelf
                  );
                  if (shelfItems.length === 0) return null;

                  return (
                    <div key={shelf} className="mb-8 shelf-section">
                      {shelfIndex > 0 && (
                        <div className="shelf-divider border-t-4 border-gray-800 my-4"></div>
                      )}
                      <div className="bg-blue-600 text-white px-3 py-2 font-bold mb-2 print-header text-base">
                        {shelf}
                      </div>
                      <table className="w-full text-xs border-collapse mb-4">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">Item</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Vendor Code</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Avg/Wk</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">On Hand</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Suggested</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Order</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">☐</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shelfItems.map((item, idx) => (
                            <tr key={idx} className={item.avgWeekly < 0.3 ? 'bg-red-50' : item.avgWeekly >= 5 ? 'bg-green-50' : ''}>
                              <td className="border border-gray-300 px-2 py-1">{item.itemName}</td>
                              <td className="border border-gray-300 px-2 py-1 text-gray-600">{item.sku || '-'}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{item.avgWeekly}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"></td>
                              <td className="border border-gray-300 px-2 py-1 text-center bg-yellow-50 font-semibold">{item.suggestedOrder}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center bg-green-50 font-bold">{item.orderQuantity || 0}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center">☐</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Fallback: group by category if no shelf locations
              <div>
                {categories.map((category, categoryIndex) => {
                  const categoryItems = printSortedItems.filter(item => item.category === category);
                  if (categoryItems.length === 0) return null;

                  return (
                    <div key={category} className="mb-8 shelf-section">
                      {categoryIndex > 0 && (
                        <div className="shelf-divider border-t-4 border-gray-800 my-4"></div>
                      )}
                      <div className="bg-blue-600 text-white px-3 py-2 font-bold mb-2 print-header text-base">
                        {category}
                      </div>
                      <table className="w-full text-xs border-collapse mb-4">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">Item</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Vendor Code</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Avg/Wk</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">On Hand</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Suggested</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">Order</th>
                            <th className="border border-gray-300 px-2 py-1 text-center">☐</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map((item, idx) => (
                            <tr key={idx} className={item.avgWeekly < 0.3 ? 'bg-red-50' : item.avgWeekly >= 5 ? 'bg-green-50' : ''}>
                              <td className="border border-gray-300 px-2 py-1">{item.itemName}</td>
                              <td className="border border-gray-300 px-2 py-1 text-gray-600">{item.sku || '-'}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{item.avgWeekly}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"></td>
                              <td className="border border-gray-300 px-2 py-1 text-center bg-yellow-50 font-semibold">{item.suggestedOrder}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center bg-green-50 font-bold">{item.orderQuantity || 0}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center">☐</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 pt-4 border-t-2 border-gray-400">
              <div className="flex justify-between">
                <div><strong>Ordered By:</strong> _________________________</div>
                <div><strong>Date:</strong> _________________________</div>
              </div>
            </div>
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
              padding: 0.5cm !important;
            }
            .print-header {
              background-color: #2563eb !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .bg-green-50 {
              background-color: #f0fdf4 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .bg-red-50 {
              background-color: #fef2f2 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .bg-yellow-50 {
              background-color: #fefce8 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 0.75cm;
            }

            /* Reduce spacing between sections */
            .mb-8 {
              margin-bottom: 0.5cm !important;
            }
            .mt-8 {
              margin-top: 0.5cm !important;
            }

            /* Shelf dividers */
            .shelf-divider {
              border-top: 3px solid #000 !important;
              margin: 0.75cm 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .shelf-section {
              margin-bottom: 0.75cm !important;
            }

            /* Make headers larger and more prominent */
            .print-header {
              font-size: 14px !important;
              padding: 8px 12px !important;
              page-break-after: avoid;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Continuous flow - no forced page breaks between sections */
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }

            /* Prevent orphans and widows */
            p, h1, h2, h3 {
              orphans: 3;
              widows: 3;
            }

            /* Prevent page breaks immediately after dividers */
            .shelf-divider {
              page-break-after: avoid;
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
