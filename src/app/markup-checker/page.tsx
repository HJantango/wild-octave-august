'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

interface MarkupItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  shelfLabel: string;
  vendorName: string;
  cost: number;
  actualMarkup: number;
  actualSellExGst: number;
  actualSellIncGst: number;
  expectedSellExGst: number;
  expectedSellIncGst: number;
  markupDiff: number;
  priceDiffExGst: number;
  priceDiffIncGst: number;
  status: 'on-target' | 'under' | 'over';
}

interface MarkupData {
  summary: {
    totalItems: number;
    onTarget: number;
    under: number;
    over: number;
    targetMarkup: number;
    tolerance: number;
  };
  categories: string[];
  shelfLabels: string[];
  items: MarkupItem[];
}

export default function MarkupCheckerPage() {
  const router = useRouter();
  const [data, setData] = useState<MarkupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [shelfLabel, setShelfLabel] = useState('all');
  const [targetMarkup, setTargetMarkup] = useState('1.75');

  const handlePrintFixes = () => {
    const params = new URLSearchParams();
    if (category !== 'all') params.append('category', category);
    if (shelfLabel !== 'all') params.append('shelfLabel', shelfLabel);
    params.append('targetMarkup', targetMarkup);
    router.push(`/markup-checker/print?${params}`);
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under' | 'over' | 'on-target'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      if (shelfLabel !== 'all') params.append('shelfLabel', shelfLabel);
      params.append('targetMarkup', targetMarkup);
      
      const res = await fetch(`/api/reports/markup-checker?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [category, shelfLabel, targetMarkup]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    let items = data.items;
    
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.vendorName.toLowerCase().includes(term) ||
          (i.sku && i.sku.toLowerCase().includes(term))
      );
    }
    
    if (statusFilter !== 'all') {
      items = items.filter((i) => i.status === statusFilter);
    }
    
    return items;
  }, [data, search, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'under':
        return <Badge className="bg-red-100 text-red-800">Under ⚠️</Badge>;
      case 'over':
        return <Badge className="bg-blue-100 text-blue-800">Over</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800">On Target ✓</Badge>;
    }
  };

  const formatMarkup = (markup: number) => {
    return `${(markup * 100).toFixed(1)}%`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold mb-2">🎯 Markup Checker</h1>
            <p className="text-indigo-100">
              Check products against target markup — see which ones need attention
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {data?.categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Label</label>
                <Select value={shelfLabel} onValueChange={setShelfLabel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Shelf Labels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shelf Labels</SelectItem>
                    {data?.shelfLabels.map((label) => (
                      <SelectItem key={label} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Markup</label>
                <Select value={targetMarkup} onValueChange={setTargetMarkup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.5">1.5x (50%)</SelectItem>
                    <SelectItem value="1.6">1.6x (60%)</SelectItem>
                    <SelectItem value="1.65">1.65x (65%)</SelectItem>
                    <SelectItem value="1.7">1.7x (70%)</SelectItem>
                    <SelectItem value="1.75">1.75x (75%)</SelectItem>
                    <SelectItem value="1.8">1.8x (80%)</SelectItem>
                    <SelectItem value="1.85">1.85x (85%)</SelectItem>
                    <SelectItem value="1.9">1.9x (90%)</SelectItem>
                    <SelectItem value="2.0">2.0x (100%)</SelectItem>
                    <SelectItem value="2.2">2.2x (120%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="under">Under Target ⚠️</SelectItem>
                    <SelectItem value="over">Over Target</SelectItem>
                    <SelectItem value="on-target">On Target ✓</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{data.summary.totalItems}</div>
                <div className="text-sm text-gray-500">Total Products</div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-700">{data.summary.onTarget}</div>
                <div className="text-sm text-green-600">On Target ✓</div>
              </CardContent>
            </Card>
            <Card 
              className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
              onClick={handlePrintFixes}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-700">{data.summary.under}</div>
                <div className="text-sm text-red-600">Under Target ⚠️</div>
                <div className="text-xs text-red-500 mt-1">🖨️ Click to print</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-700">{data.summary.over}</div>
                <div className="text-sm text-blue-600">Over Target</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Products {filteredItems.length !== data?.items.length && `(${filteredItems.length} shown)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No products found matching your criteria
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Product</th>
                      <th className="text-left p-3">Shelf</th>
                      <th className="text-right p-3">Cost</th>
                      <th className="text-right p-3">Actual Markup</th>
                      <th className="text-right p-3">Current Price</th>
                      <th className="text-right p-3">Target Price</th>
                      <th className="text-right p-3">Diff</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`border-b hover:bg-gray-50 ${
                          item.status === 'under' ? 'bg-red-50/50' : 
                          item.status === 'over' ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.vendorName}</div>
                        </td>
                        <td className="p-3 text-gray-600">{item.shelfLabel}</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(item.cost)}</td>
                        <td className="p-3 text-right font-mono">
                          {item.actualMarkup.toFixed(2)}x
                          <span className="text-gray-400 text-xs ml-1">
                            ({formatMarkup(item.actualMarkup - 1)})
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">{formatCurrency(item.actualSellIncGst)}</td>
                        <td className="p-3 text-right font-mono text-gray-500">
                          {formatCurrency(item.expectedSellIncGst)}
                        </td>
                        <td className={`p-3 text-right font-mono ${
                          item.priceDiffIncGst < 0 ? 'text-red-600' : 
                          item.priceDiffIncGst > 0 ? 'text-blue-600' : ''
                        }`}>
                          {item.priceDiffIncGst >= 0 ? '+' : ''}{formatCurrency(item.priceDiffIncGst)}
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(item.status)}
                        </td>
                      </tr>
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
