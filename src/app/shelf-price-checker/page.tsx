'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { PrinterIcon, CheckCircleIcon, RefreshCwIcon, TagIcon, SaveIcon, DownloadIcon, UploadIcon } from 'lucide-react';
import { checkDymoService, printLabels, formatPriceForLabel, type ShelfLabel } from '@/lib/dymo';

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
        alert(`✅ Printed ${result.success} labels${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
        // Optionally clear the printed labels
        if (result.failed === 0) {
          clearAllLabels();
        }
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

  // Calculate progress
  const allItems = shelfGroups.flatMap(g => g.items);
  const checkedCount = allItems.filter(item => checkedItems[item.id]).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
  
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
