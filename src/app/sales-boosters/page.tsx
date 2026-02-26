'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, TrendingUp, ShoppingCart, Target, Search } from 'lucide-react';

interface CrossSellRule {
  itemA: string;
  itemB: string;
  support: number;
  confidence: number;
  lift: number;
  transactions: number;
  expectedTransactions: number;
}

interface CrossSellData {
  rules: CrossSellRule[];
  pairs: Array<{ itemA: string; itemB: string; count: number }>;
  summary: {
    totalBaskets: number;
    totalItems: number;
    totalRules: number;
    strongRules: number;
    dateRange: { start: number | null; end: number | null };
    parameters: { minSupport: number; minConfidence: number };
  };
  topItems: Array<{ item: string; count: number; frequency: number }>;
}

export default function SalesBoostersPage() {
  const [data, setData] = useState<CrossSellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales/cross-sell-analysis');
      if (!response.ok) throw new Error('Failed to fetch cross-sell data');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRules = data?.rules.filter(rule => 
    !searchTerm || 
    rule.itemA.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.itemB.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getItemSuggestions = (item: string) => {
    return data?.rules.filter(rule => 
      rule.itemA.toLowerCase() === item.toLowerCase()
    ).slice(0, 5) || [];
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatLift = (value: number) => `${value.toFixed(2)}x`;

  const getLiftColor = (lift: number) => {
    if (lift > 2) return 'bg-green-100 text-green-800';
    if (lift > 1.5) return 'bg-blue-100 text-blue-800';
    if (lift > 1) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Analyzing purchase patterns...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
            <Button onClick={fetchData} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Boosters</h1>
          <p className="text-gray-600 mt-2">
            Smart cross-sell suggestions to increase average transaction value
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{data?.summary.totalBaskets.toLocaleString()}</p>
                <p className="text-gray-600 text-sm">Multi-item Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{data?.summary.strongRules}</p>
                <p className="text-gray-600 text-sm">Strong Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{data?.summary.totalItems}</p>
                <p className="text-gray-600 text-sm">Unique Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Search className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{data?.summary.totalRules}</p>
                <p className="text-gray-600 text-sm">Total Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Suggestions Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              🎯 Live POS Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Type an item to get cross-sell suggestions..."
                value={selectedItem || ''}
                onChange={(e) => setSelectedItem(e.target.value)}
              />
              
              {selectedItem && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-700">
                    💡 Customers who bought "{selectedItem}" also bought:
                  </h4>
                  {getItemSuggestions(selectedItem).map((rule, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium">{rule.itemB}</p>
                        <p className="text-sm text-gray-600">
                          {formatPercentage(rule.confidence)} of the time
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getLiftColor(rule.lift)}>
                          {formatLift(rule.lift)} stronger
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {getItemSuggestions(selectedItem).length === 0 && (
                    <p className="text-gray-500 italic">
                      No strong cross-sell patterns found for this item.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Item Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Most Frequent Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.topItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{item.item}</span>
                  <div className="text-right">
                    <Badge variant="secondary">
                      {formatPercentage(item.frequency)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Cross-Sell Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🔍 All Cross-Sell Patterns
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredRules.slice(0, 20).map((rule, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium">
                    <span className="text-blue-600">{rule.itemA}</span>
                    <span className="mx-2">→</span>
                    <span className="text-green-600">{rule.itemB}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Found together in {rule.transactions} transaction days 
                    (expected: {rule.expectedTransactions})
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {formatPercentage(rule.confidence)}
                  </Badge>
                  <Badge className={getLiftColor(rule.lift)}>
                    {formatLift(rule.lift)}
                  </Badge>
                </div>
              </div>
            ))}
            {filteredRules.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No patterns found matching your search.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}