'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { PrinterIcon, CheckCircleIcon, RefreshCwIcon, TagIcon, SaveIcon, DownloadIcon, UploadIcon, PackageIcon, SearchIcon, XIcon } from 'lucide-react';

// Fuzzy word-initial matching (like Square's search)
// "o m" matches "Organic Milk", "pb" matches "Peanut Butter"
const fuzzyMatch = (query: string, text: string): boolean => {
  if (!query.trim()) return true;
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // First: simple includes check (if they type part of a word)
  if (textLower.includes(queryLower)) return true;
  
  // Second: word-initial matching
  // Split query into tokens (by space or treat as continuous initials)
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  const words = textLower.split(/\s+/);
  
  if (tokens.length === 0) return true;
  
  // Try to match each token to the start of a word (in order)
  let wordIndex = 0;
  for (const token of tokens) {
    let found = false;
    while (wordIndex < words.length) {
      if (words[wordIndex].startsWith(token)) {
        found = true;
        wordIndex++;
        break;
      }
      wordIndex++;
    }
    if (!found) return false;
  }
  return true;
};
import { checkDymoService, printLabels, formatPriceForLabel, type ShelfLabel } from '@/lib/dymo';

interface ShelfItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
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

interface LabelState {
  [itemId: string]: 'missing' | 'update' | null;
}

const STORAGE_KEY = 'shelf-price-checker-state';
const LABEL_STORAGE_KEY = 'shelf-price-checker-labels';

export default function ShelfPriceCheckerPage() {
  const [shelfGroups, setShelfGroups] = useState<ShelfGroup[]>([]);
  const [availableShelves, setAvailableShelves] = useState<string[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shelfFilter, setShelfFilter] = useState('all');
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});
  const [labelNeeds, setLabelNeeds] = useState<LabelState>({});
  const [compactMode, setCompactMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<ShelfItem | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  
  // DYMO printing state
  const [dymoAvailable, setDymoAvailable] = useState<boolean | null>(null);
  const [dymoError, setDymoError] = useState<string | null>(null);
  const [dymoPrinters, setDymoPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });
  
  // Server backup state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Catalog sync state
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Load state - try server first, then localStorage
  useEffect(() => {
    const loadState = async () => {
      // Try to load from server first
      try {
        const response = await fetch('/api/shelf-checker-state');
        const result = await response.json();
        if (result.success && result.data.savedAt) {
          console.log('[Shelf Checker] Loaded from server:', result.data);
          setCheckedItems(result.data.checkedItems || {});
          setLabelNeeds(result.data.labelNeeds || {});
          setLastSaved(result.data.savedAt);
          // Also update localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data.checkedItems || {}));
          localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(result.data.labelNeeds || {}));
          return;
        }
      } catch (e) {
        console.log('[Shelf Checker] Server load failed, trying localStorage');
      }

      // Fall back to localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading saved state:', e);
        }
      }
      const savedLabels = localStorage.getItem(LABEL_STORAGE_KEY);
      if (savedLabels) {
        try {
          setLabelNeeds(JSON.parse(savedLabels));
        } catch (e) {
          console.error('Error loading label state:', e);
        }
      }
    };
    loadState();
  }, []);

  // Save to localStorage (immediate)
  const saveCheckedState = useCallback((state: CheckedState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setHasUnsavedChanges(true);
  }, []);

  // Save label state to localStorage (immediate)
  const saveLabelState = useCallback((state: LabelState) => {
    localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(state));
    setHasUnsavedChanges(true);
  }, []);

  // Save to server (manual backup)
  const saveToServer = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/shelf-checker-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedItems, labelNeeds })
      });
      const result = await response.json();
      if (result.success) {
        setLastSaved(result.savedAt);
        setHasUnsavedChanges(false);
        alert(`✅ ${result.message}`);
      } else {
        alert('❌ Failed to save: ' + result.error);
      }
    } catch (e) {
      console.error('Save error:', e);
      alert('❌ Failed to save to server');
    } finally {
      setSaving(false);
    }
  };

  // Sync catalog from Square (updates prices)
  const handleCatalogSync = async () => {
    setSyncingCatalog(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/square/catalog-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        const summary = result.data?.summary || result.summary;
        setSyncMessage(`✅ Catalog synced: ${summary?.updated || 0} updated, ${summary?.created || 0} created`);
        // Refresh the price data
        fetchData();
      } else {
        setSyncMessage(`❌ ${result.error?.message || 'Catalog sync failed'}`);
      }
    } catch (err) {
      setSyncMessage('❌ Failed to sync catalog');
    } finally {
      setSyncingCatalog(false);
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  // Export data as JSON file
  const exportData = () => {
    const data = {
      checkedItems,
      labelNeeds,
      exportedAt: new Date().toISOString(),
      stats: {
        totalChecked: Object.keys(checkedItems).filter(k => checkedItems[k]).length,
        missingLabels: Object.values(labelNeeds).filter(v => v === 'missing').length,
        needsUpdate: Object.values(labelNeeds).filter(v => v === 'update').length,
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shelf-checker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check DYMO service on mount
  useEffect(() => {
    const checkDymo = async () => {
      const result = await checkDymoService();
      setDymoAvailable(result.available);
      setDymoPrinters(result.printers);
      setDymoError(result.error || null);
      if (result.printers.length > 0) {
        // Auto-select first printer (likely the DYMO 550)
        setSelectedPrinter(result.printers[0]);
      }
      console.log('[Shelf Checker] DYMO status:', result);
    };
    checkDymo();
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

  const toggleLabelNeed = (itemId: string, type: 'missing' | 'update') => {
    setLabelNeeds(prev => {
      const current = prev[itemId];
      const newState = { ...prev };
      if (current === type) {
        // Toggle off
        delete newState[itemId];
      } else {
        // Set to this type
        newState[itemId] = type;
      }
      saveLabelState(newState);
      return newState;
    });
  };

  const clearAllLabels = () => {
    setLabelNeeds({});
    localStorage.removeItem(LABEL_STORAGE_KEY);
  };

  const handlePrint = () => {
    window.print();
  };

  // Recheck DYMO service
  const recheckDymo = async () => {
    setDymoAvailable(null); // Show loading state
    const result = await checkDymoService();
    setDymoAvailable(result.available);
    setDymoPrinters(result.printers);
    setDymoError(result.error || null);
    if (result.printers.length > 0) {
      setSelectedPrinter(result.printers[0]);
    }
    console.log('[Shelf Checker] DYMO recheck:', result);
  };

  // Print labels to DYMO
  const handlePrintLabels = async () => {
    if (!dymoAvailable || totalLabelNeeds === 0) return;
    
    // Get all items that need labels
    const allItems = shelfGroups.flatMap(g => g.items);
    const itemsToPrint = allItems.filter(item => labelNeeds[item.id]);
    
    if (itemsToPrint.length === 0) return;
    
    const labels: ShelfLabel[] = itemsToPrint.map(item => ({
      productName: item.name,
      price: formatPriceForLabel(item.price),
    }));
    
    setPrinting(true);
    setPrintProgress({ current: 0, total: labels.length });
    
    try {
      const result = await printLabels(
        labels, 
        selectedPrinter,
        (current, total) => setPrintProgress({ current, total })
      );
      
      if (result.success > 0) {
        alert(`✅ Printed ${result.success} labels${result.failed > 0 ? ` (${result.failed} failed)` : ''}!\n\nUse "Clear Labels" button when you're done, or print again if needed.`);
        // DON'T auto-clear - let user decide when to clear
      } else {
        alert('❌ Failed to print labels. Is DYMO Connect running?');
      }
    } catch (err) {
      console.error('Print error:', err);
      alert('❌ Print error. Check DYMO Connect is running.');
    } finally {
      setPrinting(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  // Print single scanned item immediately
  const handlePrintScannedItem = async (item: ShelfItem) => {
    if (!dymoAvailable) return;
    
    const label: ShelfLabel = {
      productName: item.name,
      price: formatPriceForLabel(item.price),
    };
    
    setPrinting(true);
    setPrintProgress({ current: 0, total: 1 });
    
    try {
      const result = await printLabels(
        [label], 
        selectedPrinter,
        (current, total) => setPrintProgress({ current, total })
      );
      
      if (result.success > 0) {
        console.log(`✅ Printed label for: ${item.name}`);
        // Don't show alert for single prints, just clear barcode result
        setBarcodeResult(null);
        setBarcodeInput('');
      } else {
        alert('❌ Failed to print label. Is DYMO Connect running?');
      }
    } catch (err) {
      console.error('Print error:', err);
      alert('❌ Print error. Check DYMO Connect is running.');
    } finally {
      setPrinting(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  // Add scanned item to print queue
  const handleAddScannedToQueue = (item: ShelfItem) => {
    setLabelNeeds(prev => {
      const newState = { ...prev, [item.id]: 'missing' as const };
      saveLabelState(newState);
      return newState;
    });
    
    // Clear barcode result and show success
    setBarcodeResult(null);
    setBarcodeInput('');
    console.log(`📋 Added to print queue: ${item.name}`);
  };

  // Barcode lookup function - now uses dedicated API that searches ALL items
  const handleBarcodeLookup = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      setBarcodeResult(null);
      setBarcodeNotFound(false);
      return;
    }
    
    try {
      console.log(`🔍 Looking up barcode: "${trimmed}"`);
      const response = await fetch(`/api/barcode-lookup?barcode=${encodeURIComponent(trimmed)}`);
      const result = await response.json();
      
      if (result.success && result.data.found) {
        const foundItem: ShelfItem = {
          id: result.data.id,
          name: result.data.name,
          sku: result.data.sku,
          barcode: result.data.barcode,
          price: result.data.price,
          categoryName: result.data.categoryName,
        };
        
        setBarcodeResult(foundItem);
        setBarcodeNotFound(false);
        console.log(`✅ Found: "${foundItem.name}" (${result.data.matchedBy})`);
        
        // Auto-clear after 8 seconds for next scan
        setTimeout(() => {
          setBarcodeInput('');
          setBarcodeResult(null);
        }, 8000);
      } else {
        setBarcodeResult(null);
        setBarcodeNotFound(true);
        console.log(`❌ Barcode not found: "${trimmed}"`);
        
        // Clear "not found" after 3 seconds
        setTimeout(() => {
          setBarcodeNotFound(false);
          setBarcodeInput('');
        }, 3000);
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
      setBarcodeResult(null);
      setBarcodeNotFound(true);
      setTimeout(() => {
        setBarcodeNotFound(false);
        setBarcodeInput('');
      }, 3000);
    }
  }, []);

  // Handle barcode input (scanner usually sends Enter at end)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeLookup(barcodeInput); // Now async but we don't need to await
    }
  };

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return shelfGroups;
    
    return shelfGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => fuzzyMatch(searchQuery, item.name)),
        itemCount: group.items.filter(item => fuzzyMatch(searchQuery, item.name)).length
      }))
      .filter(group => group.items.length > 0);
  }, [shelfGroups, searchQuery]);

  // Calculate progress (based on all items, not filtered)
  const allItems = shelfGroups.flatMap(g => g.items);
  const checkedCount = allItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
  
  // Calculate filtered stats
  const filteredItemCount = filteredGroups.flatMap(g => g.items).length;
  const isFiltered = searchQuery.trim().length > 0;
  
  // Calculate label needs
  const missingLabelCount = Object.values(labelNeeds).filter(v => v === 'missing').length;
  const updateLabelCount = Object.values(labelNeeds).filter(v => v === 'update').length;
  const totalLabelNeeds = missingLabelCount + updateLabelCount;

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
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="bg-white/20 rounded-full px-3 py-1 text-sm">
                      ✓ {checkedCount} / {totalItems} checked ({progressPercent}%)
                    </div>
                    {totalLabelNeeds > 0 && (
                      <>
                        {missingLabelCount > 0 && (
                          <div className="bg-red-500/80 rounded-full px-3 py-1 text-sm">
                            🚫 {missingLabelCount} missing
                          </div>
                        )}
                        {updateLabelCount > 0 && (
                          <div className="bg-amber-500/80 rounded-full px-3 py-1 text-sm">
                            🔄 {updateLabelCount} need update
                          </div>
                        )}
                      </>
                    )}
                    {lastSaved && (
                      <div className="bg-blue-500/60 rounded-full px-3 py-1 text-sm">
                        💾 Saved: {new Date(lastSaved).toLocaleString()}
                      </div>
                    )}
                    {syncMessage && (
                      <div className={`rounded-full px-3 py-1 text-sm ${syncMessage.startsWith('✅') ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                        {syncMessage}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 lg:mt-0 flex flex-wrap items-center gap-2">
                  {/* Search Input */}
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                    <Input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 pl-8 pr-8 bg-white/20 border-white/20 text-white placeholder:text-white/60 focus:bg-white/30"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
                  {/* SAVE BUTTON - Primary action */}
                  <Button 
                    onClick={saveToServer}
                    disabled={saving}
                    className={`${hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'} text-white font-semibold`}
                  >
                    <SaveIcon className="w-4 h-4 mr-1" />
                    {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes!' : 'Save'}
                  </Button>
                  <Button 
                    onClick={exportData}
                    variant="outline"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                    title="Download backup file"
                  >
                    <DownloadIcon className="w-4 h-4 mr-1" /> Export
                  </Button>
                  <Button 
                    onClick={handleCatalogSync}
                    disabled={syncingCatalog}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                    title="Pull latest prices from Square"
                  >
                    <PackageIcon className="w-4 h-4 mr-1" />
                    {syncingCatalog ? '🔄 Syncing...' : '📦 Sync Prices'}
                  </Button>
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
                    Reset Checks
                  </Button>
                  {totalLabelNeeds > 0 && (
                    <Button 
                      onClick={clearAllLabels}
                      variant="outline"
                      className="bg-red-500/50 hover:bg-red-500/70 text-white border-red-400/50"
                    >
                      Clear Labels ({totalLabelNeeds})
                    </Button>
                  )}
                  {/* DYMO Print Button */}
                  {totalLabelNeeds > 0 && dymoAvailable && (
                    <Button 
                      onClick={handlePrintLabels}
                      disabled={printing}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <TagIcon className="w-4 h-4 mr-1" />
                      {printing 
                        ? `Printing ${printProgress.current}/${printProgress.total}...` 
                        : `Print ${totalLabelNeeds} Labels`}
                    </Button>
                  )}
                  {dymoAvailable === false && totalLabelNeeds > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-yellow-200 bg-yellow-600/50 px-2 py-1 rounded" title={dymoError || undefined}>
                        ⚠️ DYMO not detected
                      </div>
                      <Button 
                        onClick={recheckDymo}
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs h-6 px-2"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {dymoAvailable === null && (
                    <div className="text-xs text-blue-200 bg-blue-600/50 px-2 py-1 rounded">
                      Checking DYMO...
                    </div>
                  )}
                  {dymoAvailable && dymoPrinters.length > 0 && (
                    <div className="text-xs text-green-200 bg-green-600/50 px-2 py-1 rounded">
                      ✓ DYMO: {selectedPrinter || dymoPrinters[0]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">Shelf Price Checker — {shelfFilter === 'all' ? 'All Shelves' : shelfFilter}</h1>
          <p className="text-sm text-gray-600">
            Printed: {new Date().toLocaleDateString()} • {totalItems} items
            {totalLabelNeeds > 0 && (
              <span className="ml-2">
                • <span className="text-red-600">{missingLabelCount} missing labels</span>
                • <span className="text-amber-600">{updateLabelCount} need updates</span>
              </span>
            )}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg print:hidden">
            {error}
          </div>
        )}

        {/* Barcode Scanner Section */}
        <Card className="print:hidden border-2 border-dashed border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2 min-w-fit">
                <span className="text-2xl">📦</span>
                <span className="font-semibold text-gray-700">Barcode Lookup</span>
              </div>
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Scan or type barcode..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    className="text-lg h-12 font-mono pr-20"
                    autoComplete="off"
                  />
                  <Button
                    onClick={() => handleBarcodeLookup(barcodeInput)} // Now async but onClick doesn't need await
                    disabled={!barcodeInput.trim()}
                    className="absolute right-1 top-1 h-10"
                    size="sm"
                  >
                    Look Up
                  </Button>
                </div>
              </div>
              
              {/* Result Display */}
              {barcodeResult && (
                <div className="flex-1 bg-green-100 border border-green-300 rounded-lg p-3 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-green-900 text-lg">{barcodeResult.name}</div>
                      <div className="text-green-700 text-sm mb-2">
                        Shelf: <span className="font-medium">{barcodeResult.categoryName}</span>
                        {barcodeResult.barcode && <span className="ml-2 text-green-600">• Barcode: {barcodeResult.barcode}</span>}
                        {barcodeResult.sku && !barcodeResult.barcode && <span className="ml-2 text-green-600">• SKU: {barcodeResult.sku}</span>}
                      </div>
                      
                      {/* Print Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        {dymoAvailable && (
                          <>
                            <Button
                              onClick={() => handlePrintScannedItem(barcodeResult)}
                              disabled={printing}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                            >
                              <TagIcon className="w-3 h-3 mr-1" />
                              {printing ? 'Printing...' : 'Print Now'}
                            </Button>
                            <Button
                              onClick={() => handleAddScannedToQueue(barcodeResult)}
                              disabled={printing}
                              size="sm"
                              variant="outline"
                              className="border-green-400 text-green-700 hover:bg-green-50 text-xs h-7"
                            >
                              Add to Queue
                            </Button>
                          </>
                        )}
                        {!dymoAvailable && (
                          <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                            DYMO not available - labels disabled
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-800 whitespace-nowrap">
                      {formatCurrency(barcodeResult.price)}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Not Found */}
              {barcodeNotFound && (
                <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <span className="text-xl">❌</span>
                    <span className="font-medium">Barcode not found: {barcodeInput}</span>
                  </div>
                </div>
              )}
              
              {/* Idle hint */}
              {!barcodeResult && !barcodeNotFound && !barcodeInput && (
                <div className="flex-1 text-gray-500 text-sm">
                  Scan a barcode or type SKU and press Enter
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search results indicator */}
        {isFiltered && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg flex items-center justify-between print:hidden">
            <span>
              <SearchIcon className="w-4 h-4 inline mr-2" />
              Showing {filteredItemCount} of {totalItems} items matching "{searchQuery}"
            </span>
            <button 
              onClick={() => setSearchQuery('')}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Compact Print Layout */}
        <div className="space-y-3 print:space-y-2">
          {filteredGroups.map((group) => {
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                    {group.items.map((item) => {
                      const labelStatus = labelNeeds[item.id];
                      return (
                        <div
                          key={item.id}
                          className={`
                            flex items-center gap-1 py-0.5 px-1 rounded
                            ${checkedItems[item.id] ? 'bg-gray-50' : ''}
                            ${labelStatus === 'missing' ? 'bg-red-50 border border-red-200' : ''}
                            ${labelStatus === 'update' ? 'bg-amber-50 border border-amber-200' : ''}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={checkedItems[item.id] || false}
                            onChange={() => toggleItem(item.id)}
                            className="w-3 h-3 rounded print:w-2.5 print:h-2.5 cursor-pointer"
                          />
                          <span 
                            className={`flex-1 truncate cursor-pointer ${checkedItems[item.id] ? 'text-gray-400 line-through' : ''}`} 
                            title={item.name}
                            onClick={() => toggleItem(item.id)}
                          >
                            {labelStatus === 'missing' && <span className="text-red-500 mr-1">🚫</span>}
                            {labelStatus === 'update' && <span className="text-amber-500 mr-1">🔄</span>}
                            {item.name}
                          </span>
                          <span className="font-mono text-gray-600 whitespace-nowrap">
                            {formatCurrency(item.price)}
                          </span>
                          {/* Label action buttons - hidden on print */}
                          <div className="flex gap-0.5 print:hidden ml-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLabelNeed(item.id, 'missing'); }}
                              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors
                                ${labelStatus === 'missing' 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600'}`}
                              title="Missing label"
                            >
                              🚫
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLabelNeed(item.id, 'update'); }}
                              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center transition-colors
                                ${labelStatus === 'update' 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-gray-100 hover:bg-amber-100 text-gray-500 hover:text-amber-600'}`}
                              title="Needs price update"
                            >
                              🔄
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredGroups.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">{isFiltered ? '🔍' : '📋'}</div>
            {isFiltered ? (
              <>
                <p>No items match "{searchQuery}"</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p>No items found for the selected shelf.</p>
            )}
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
