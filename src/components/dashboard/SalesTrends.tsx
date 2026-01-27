'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ItemTrend {
  name: string;
  category: string;
  vendor: string;
  currentQty: number;
  previousQty: number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  currentRevenue: number;
  avgWeekly: number;
}

interface CategoryTrend {
  category: string;
  currentQty: number;
  previousQty: number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  revenue: number;
}

export function SalesTrends() {
  const [itemTrends, setItemTrends] = useState<ItemTrend[]>([]);
  const [categoryTrends, setCategoryTrends] = useState<CategoryTrend[]>([]);
  const [topMovers, setTopMovers] = useState<{ increasing: ItemTrend[]; decreasing: ItemTrend[] }>({ increasing: [], decreasing: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [viewMode, setViewMode] = useState<'movers' | 'categories'>('movers');

  useEffect(() => {
    loadTrends();
  }, [weeks]);

  const loadTrends = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ai/sales-trends?weeks=${weeks}`);
      const data = await response.json();
      if (data.success || data.data) {
        setItemTrends(data.data?.itemTrends || []);
        setCategoryTrends(data.data?.categoryTrends || []);
        setTopMovers(data.data?.topMovers || { increasing: [], decreasing: [] });
      }
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendArrow = (trend: string, change: number) => {
    if (trend === 'up') return <span className="text-green-600 font-bold">↑ {change.toFixed(0)}%</span>;
    if (trend === 'down') return <span className="text-red-600 font-bold">↓ {Math.abs(change).toFixed(0)}%</span>;
    return <span className="text-gray-500">→ flat</span>;
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardTitle className="flex items-center space-x-2">
            <span>📊</span>
            <span>Sales Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-500 text-sm">Loading trend data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>📊</span>
              <span>Sales Trends</span>
            </CardTitle>
            <CardDescription>Comparing last {weeks} weeks vs previous {weeks} weeks</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value))}
              className="text-xs px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded-md"
            >
              <option value="2">2 weeks</option>
              <option value="4">4 weeks</option>
              <option value="6">6 weeks</option>
            </select>
            <div className="inline-flex rounded border border-gray-200 bg-gray-50 p-0.5">
              <button
                onClick={() => setViewMode('movers')}
                className={`px-2 py-0.5 text-xs rounded ${viewMode === 'movers' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}
              >
                Movers
              </button>
              <button
                onClick={() => setViewMode('categories')}
                className={`px-2 py-0.5 text-xs rounded ${viewMode === 'categories' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}
              >
                Categories
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {viewMode === 'movers' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Biggest Increases */}
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                📈 Top Risers
              </h4>
              <div className="space-y-1.5">
                {topMovers.increasing.length === 0 ? (
                  <p className="text-xs text-gray-500">No significant increases</p>
                ) : (
                  topMovers.increasing.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.avgWeekly}/wk avg</p>
                      </div>
                      <div className="text-right ml-2">
                        {getTrendArrow(item.trend, item.change)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Biggest Decreases */}
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                📉 Top Fallers
              </h4>
              <div className="space-y-1.5">
                {topMovers.decreasing.length === 0 ? (
                  <p className="text-xs text-gray-500">No significant decreases</p>
                ) : (
                  topMovers.decreasing.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.avgWeekly}/wk avg</p>
                      </div>
                      <div className="text-right ml-2">
                        {getTrendArrow(item.trend, item.change)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {categoryTrends.length === 0 ? (
              <p className="text-xs text-gray-500">No category data available</p>
            ) : (
              categoryTrends.slice(0, 8).map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{cat.category}</p>
                    <p className="text-xs text-gray-500">${cat.revenue.toFixed(0)} revenue</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500">
                      {cat.previousQty.toFixed(0)} → {cat.currentQty.toFixed(0)} units
                    </div>
                    {getTrendArrow(cat.trend, cat.change)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
