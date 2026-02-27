'use client';

import { useState, useEffect } from 'react';

export default function SalesBoostersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales/cross-sell-analysis', {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 401) {
        throw new Error('Please log in to view sales data');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('API Response:', result); // Debug logging
      
      // Handle the nested data structure
      const actualData = result.data || result;
      setData(actualData);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">💰 Sales Boosters</h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4">Loading sales data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">💰 Sales Boosters</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <button 
                onClick={fetchData}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">💰 Sales Boosters</h1>
          <p className="text-gray-600">Smart cross-sell suggestions to increase sales</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <span className="text-2xl">🛒</span>
              <div className="ml-3">
                <p className="text-xl font-bold">{data?.summary?.totalBaskets || 0}</p>
                <p className="text-gray-600 text-sm">Multi-item Days</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <span className="text-2xl">🎯</span>
              <div className="ml-3">
                <p className="text-xl font-bold">{data?.summary?.strongRules || 0}</p>
                <p className="text-gray-600 text-sm">Strong Patterns</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <span className="text-2xl">📈</span>
              <div className="ml-3">
                <p className="text-xl font-bold">{data?.summary?.totalItems || 0}</p>
                <p className="text-gray-600 text-sm">Unique Items</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <span className="text-2xl">🔍</span>
              <div className="ml-3">
                <p className="text-xl font-bold">{data?.summary?.totalRules || 0}</p>
                <p className="text-gray-600 text-sm">Total Rules</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Items */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📊 Most Frequent Items</h2>
          <div className="space-y-2">
            {data?.topItems?.length > 0 ? (
              data.topItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">{item.item}</span>
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                    {((item.frequency || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No frequency data available</p>
            )}
          </div>
        </div>

        {/* Cross-sell Rules */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">🔍 Cross-Sell Patterns</h2>
          <div className="space-y-3">
            {data?.rules?.length > 0 ? (
              data.rules.slice(0, 10).map((rule: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">
                      <span className="text-blue-600">{rule.itemA}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600">{rule.itemB}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Found together {rule.transactions} times
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      {((rule.confidence || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                      {(rule.lift || 0).toFixed(2)}x
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                No cross-sell patterns found in your data.
              </p>
            )}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold mb-2">📋 Debug Info</h3>
          <div className="space-y-2">
            <div>
              <strong>Error:</strong> {error || 'None'}
            </div>
            <div>
              <strong>Data loaded:</strong> {data ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Summary:</strong>
              <pre className="text-xs text-gray-700 bg-white p-2 rounded overflow-auto mt-1">
                {JSON.stringify(data?.summary, null, 2)}
              </pre>
            </div>
            <div>
              <strong>Rules count:</strong> {data?.rules?.length || 0}
            </div>
            <div>
              <strong>Top items count:</strong> {data?.topItems?.length || 0}
            </div>
            <div>
              <strong>Full response:</strong>
              <pre className="text-xs text-gray-700 bg-white p-2 rounded overflow-auto mt-1 max-h-40">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}