'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/format';

interface RationalizationItem {
  id: string;
  name: string;
  category: string;
  shelfLabel: string | null;
  vendorName: string | null;
  sku: string | null;
  costExGst: number;
  sellIncGst: number;
  marginPercent: number;
  totalUnitsSold: number;
  totalRevenue: number;
  avgWeeklySales: number;
  weeksWithSales: number;
  similarGroup?: string;
  decision: 'keep' | 'remove' | 'staple' | null;
}

interface Summary {
  totalItems: number;
  itemsWithSales: number;
  itemsNoSales: number;
  staples: number;
  toRemove: number;
  toKeep: number;
  undecided: number;
  months: number;
}

export default function RationalizationPage() {
  const toast = useToast();
  const [items, setItems] = useState<RationalizationItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shelfLabels, setShelfLabels] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  // Filters
  const [shelfFilter, setShelfFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSimilar, setShowSimilar] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (shelfFilter !== 'all') params.append('shelfLabel', shelfFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      
      const res = await fetch(`/api/reports/product-rationalization?${params}`);
      const data = await res.json();
      
      if (data.data) {
        setItems(data.data.items);
        setSummary(data.data.summary);
        setShelfLabels(data.data.filters.shelfLabels);
        setCategories(data.data.filters.categories);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shelfFilter, categoryFilter]);

  // Run migration on first load
  useEffect(() => {
    fetch('/api/reports/product-rationalization/migrate', { method: 'POST' })
      .catch(() => {}); // Ignore errors
  }, []);

  const saveDecision = async (itemId: string, decision: 'keep' | 'remove' | 'staple' | null) => {
    setSaving(itemId);
    try {
      const res = await fetch('/api/reports/product-rationalization/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, decision }),
      });
      
      if (res.ok) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, decision } : item
        ));
        toast.success('Saved', `Marked as ${decision || 'undecided'}`);
      }
    } catch (err) {
      toast.error('Error', 'Failed to save decision');
    } finally {
      setSaving(null);
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;
    
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(i => 
        i.name.toLowerCase().includes(term) ||
        i.vendorName?.toLowerCase().includes(term) ||
        i.sku?.toLowerCase().includes(term)
      );
    }
    
    if (decisionFilter !== 'all') {
      if (decisionFilter === 'undecided') {
        result = result.filter(i => !i.decision);
      } else {
        result = result.filter(i => i.decision === decisionFilter);
      }
    }
    
    if (salesFilter === 'no-sales') {
      result = result.filter(i => i.totalUnitsSold === 0);
    } else if (salesFilter === 'low-sales') {
      result = result.filter(i => i.avgWeeklySales < 1 && i.totalUnitsSold > 0);
    } else if (salesFilter === 'good-sales') {
      result = result.filter(i => i.avgWeeklySales >= 1);
    }
    
    if (showSimilar) {
      result = result.filter(i => i.similarGroup);
    }
    
    return result;
  }, [items, search, decisionFilter, salesFilter, showSimilar]);

  // Group by similar products if enabled
  const groupedItems = useMemo(() => {
    if (!showSimilar) return { ungrouped: filteredItems };
    
    const groups: { [key: string]: RationalizationItem[] } = {};
    const ungrouped: RationalizationItem[] = [];
    
    for (const item of filteredItems) {
      if (item.similarGroup) {
        if (!groups[item.similarGroup]) {
          groups[item.similarGroup] = [];
        }
        groups[item.similarGroup].push(item);
      } else {
        ungrouped.push(item);
      }
    }
    
    return { ...groups, ungrouped };
  }, [filteredItems, showSimilar]);

  const getDecisionBadge = (decision: string | null) => {
    switch (decision) {
      case 'staple':
        return <Badge className="bg-blue-100 text-blue-800">⭐ Staple</Badge>;
      case 'keep':
        return <Badge className="bg-green-100 text-green-800">✓ Keep</Badge>;
      case 'remove':
        return <Badge className="bg-red-100 text-red-800">✕ Remove</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Undecided</Badge>;
    }
  };

  const getSalesIndicator = (item: RationalizationItem) => {
    if (item.totalUnitsSold === 0) {
      return <span className="text-red-600 font-medium">No sales</span>;
    }
    if (item.avgWeeklySales < 0.5) {
      return <span className="text-orange-600">{item.avgWeeklySales}/wk</span>;
    }
    if (item.avgWeeklySales < 2) {
      return <span className="text-yellow-600">{item.avgWeeklySales}/wk</span>;
    }
    return <span className="text-green-600">{item.avgWeeklySales}/wk</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold mb-2">📦 Product Rationalization</h1>
            <p className="text-emerald-100">
              Review products shelf-by-shelf. Mark as Keep, Remove, or Staple.
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{summary.totalItems}</div>
                <div className="text-sm text-gray-500">Total Items</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-700">{summary.itemsNoSales}</div>
                <div className="text-sm text-red-600">No Sales (6mo)</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-700">{summary.staples}</div>
                <div className="text-sm text-blue-600">⭐ Staples</div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-700">{summary.toKeep}</div>
                <div className="text-sm text-green-600">✓ Keep</div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-700">{summary.toRemove}</div>
                <div className="text-sm text-orange-600">✕ Remove</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Label</label>
                <Select value={shelfFilter} onValueChange={setShelfFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Shelves" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shelves</SelectItem>
                    {shelfLabels.map(label => (
                      <SelectItem key={label} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="undecided">Undecided</SelectItem>
                    <SelectItem value="keep">Keep</SelectItem>
                    <SelectItem value="remove">Remove</SelectItem>
                    <SelectItem value="staple">Staple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales</label>
                <Select value={salesFilter} onValueChange={setSalesFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="no-sales">No Sales</SelectItem>
                    <SelectItem value="low-sales">Low Sales (&lt;1/wk)</SelectItem>
                    <SelectItem value="good-sales">Good Sales (1+/wk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant={showSimilar ? 'default' : 'outline'}
                  onClick={() => setShowSimilar(!showSimilar)}
                  className="w-full"
                >
                  {showSimilar ? '🔗 Similar On' : '🔗 Similar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Products ({filteredItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Product</th>
                      <th className="text-left p-3">Shelf</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-right p-3">Sell</th>
                      <th className="text-right p-3">Margin</th>
                      <th className="text-right p-3">Sales</th>
                      <th className="text-right p-3">Revenue</th>
                      <th className="text-center p-3">Decision</th>
                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedItems).map(([group, groupItems]) => (
                      <>
                        {showSimilar && group !== 'ungrouped' && groupItems.length > 0 && (
                          <tr key={`group-${group}`} className="bg-purple-50">
                            <td colSpan={9} className="p-2 font-medium text-purple-800">
                              🔗 Similar: {group} ({groupItems.length} items)
                            </td>
                          </tr>
                        )}
                        {groupItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`border-b hover:bg-gray-50 ${
                              item.totalUnitsSold === 0 ? 'bg-red-50/30' : ''
                            } ${
                              item.decision === 'remove' ? 'opacity-50' : ''
                            }`}
                          >
                            <td className="p-3">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500">
                                {item.vendorName || 'No vendor'}
                                {item.similarGroup && !showSimilar && (
                                  <span className="ml-2 text-purple-600">🔗 {item.similarGroup}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-gray-600 text-xs">{item.shelfLabel || '-'}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(item.costExGst)}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(item.sellIncGst)}</td>
                            <td className={`p-3 text-right font-mono ${
                              item.marginPercent < 30 ? 'text-red-600' : 
                              item.marginPercent < 40 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {item.marginPercent}%
                            </td>
                            <td className="p-3 text-right">
                              {getSalesIndicator(item)}
                              <div className="text-xs text-gray-400">{item.totalUnitsSold} total</div>
                            </td>
                            <td className="p-3 text-right font-mono">{formatCurrency(item.totalRevenue)}</td>
                            <td className="p-3 text-center">
                              {getDecisionBadge(item.decision)}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  size="sm"
                                  variant={item.decision === 'staple' ? 'default' : 'outline'}
                                  onClick={() => saveDecision(item.id, item.decision === 'staple' ? null : 'staple')}
                                  disabled={saving === item.id}
                                  className="px-2"
                                  title="Staple"
                                >
                                  ⭐
                                </Button>
                                <Button
                                  size="sm"
                                  variant={item.decision === 'keep' ? 'default' : 'outline'}
                                  onClick={() => saveDecision(item.id, item.decision === 'keep' ? null : 'keep')}
                                  disabled={saving === item.id}
                                  className="px-2 bg-green-600 hover:bg-green-700"
                                  title="Keep"
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="sm"
                                  variant={item.decision === 'remove' ? 'default' : 'outline'}
                                  onClick={() => saveDecision(item.id, item.decision === 'remove' ? null : 'remove')}
                                  disabled={saving === item.id}
                                  className="px-2 bg-red-600 hover:bg-red-700"
                                  title="Remove"
                                >
                                  ✕
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
