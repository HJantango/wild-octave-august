'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SquareVendorDebugPage() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runDebug();
  }, []);

  const runDebug = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/square-vendor-trace');
      const data = await response.json();
      setDebugData(data.data || data);
    } catch (error) {
      console.error('Debug failed:', error);
      setDebugData({ error: 'Failed to run debug trace' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (step: string) => {
    if (step.includes('✅')) return '✅';
    if (step.includes('❌')) return '❌';
    if (step.includes('🎯')) return '🎯';
    if (step.includes('🥤')) return '🥤';
    if (step.includes('🛒')) return '🛒';
    return '🔍';
  };

  const getStatusColor = (step: string) => {
    if (step.includes('✅')) return 'text-green-700 bg-green-50 border-green-200';
    if (step.includes('❌')) return 'text-red-700 bg-red-50 border-red-200';
    if (step.includes('🎯') || step.includes('🥤')) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (step.includes('🛒')) return 'text-purple-700 bg-purple-50 border-purple-200';
    return 'text-gray-700 bg-gray-50 border-gray-200';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">🔍 Square Vendor Debug Trace</h1>
          <p className="text-blue-100">
            Deep dive into Square API vendor extraction to find the root cause
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-lg">Running Square API vendor trace...</div>
              <div className="text-sm text-gray-600 mt-2">This may take 10-20 seconds</div>
            </CardContent>
          </Card>
        ) : debugData ? (
          <div className="space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Debug Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border">
                    <div className="text-2xl font-bold text-blue-700">
                      {debugData.vendors?.length || 0}
                    </div>
                    <div className="text-sm text-blue-600">Square Vendors</div>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg border">
                    <div className="text-2xl font-bold text-green-700">
                      {debugData.catalogItems?.length || 0}
                    </div>
                    <div className="text-sm text-green-600">Items with Vendors</div>
                  </div>
                  
                  <div className="p-3 bg-purple-50 rounded-lg border">
                    <div className="text-2xl font-bold text-purple-700">
                      {debugData.heapsGoodItems?.length || 0}
                    </div>
                    <div className="text-sm text-purple-600">Heaps Good Items</div>
                  </div>
                  
                  <div className="p-3 bg-red-50 rounded-lg border">
                    <div className="text-2xl font-bold text-red-700">
                      {debugData.errors?.length || 0}
                    </div>
                    <div className="text-sm text-red-600">Errors</div>
                  </div>
                </div>
                
                {debugData.timestamp && (
                  <div className="mt-4 text-xs text-gray-500">
                    Debug run: {new Date(debugData.timestamp).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debug Steps */}
            <Card>
              <CardHeader>
                <CardTitle>🔍 Debug Trace Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {debugData.steps?.map((step: string, i: number) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border text-sm font-mono ${getStatusColor(step)}`}
                    >
                      <span className="mr-2">{getStatusIcon(step)}</span>
                      {step.replace(/^(✅|❌|🎯|🥤|🛒)\s*/, '')}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vendors Found */}
            {debugData.vendors?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>🏪 Square Vendors ({debugData.vendors.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {debugData.vendors.map((vendor: any, i: number) => (
                      <div 
                        key={i} 
                        className={`p-2 rounded border text-sm ${
                          vendor.name.toLowerCase().includes('heaps good') 
                            ? 'bg-green-100 border-green-300 font-semibold' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="font-medium">{vendor.name}</div>
                        <div className="text-xs text-gray-600">ID: {vendor.id}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Heaps Good Items */}
            {debugData.heapsGoodItems?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>🥤 Heaps Good Items Found ({debugData.heapsGoodItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {debugData.heapsGoodItems.map((item: any, i: number) => (
                      <div key={i} className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="font-medium text-green-800">{item.itemName}</div>
                        <div className="text-sm text-green-600">
                          Vendor: <strong>{item.vendorName}</strong> (ID: {item.vendorId})
                        </div>
                        <div className="text-xs text-green-500">
                          Item ID: {item.itemId} | Variation: {item.variationId}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Errors */}
            {debugData.errors?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>❌ Errors ({debugData.errors.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {debugData.errors.map((error: string, i: number) => (
                      <div key={i} className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
                        {error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>🎯 Analysis & Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {debugData.heapsGoodItems?.length > 0 ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                      <div className="font-semibold text-green-800 mb-2">✅ Heaps Good Found in Square!</div>
                      <div className="text-sm text-green-700">
                        {debugData.heapsGoodItems.length} Heaps Good items found with proper vendor assignments in Square.
                        The issue is likely in the sales sync not properly extracting this vendor data.
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded">
                      <div className="font-semibold text-red-800 mb-2">❌ No Heaps Good Found in Square</div>
                      <div className="text-sm text-red-700">
                        Heaps Good items are not properly assigned to vendors in Square catalog,
                        or the vendor "Heaps Good" doesn't exist in Square.
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                    <div className="font-semibold text-blue-800 mb-2">🔧 Recommended Actions:</div>
                    <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                      {debugData.vendors?.length === 0 && (
                        <li>Check Square admin - ensure vendors are properly configured</li>
                      )}
                      {debugData.heapsGoodItems?.length === 0 && debugData.vendors?.length > 0 && (
                        <li>In Square admin - assign "Heaps Good" vendor to Heaps Good products</li>
                      )}
                      {debugData.heapsGoodItems?.length > 0 && (
                        <li>Run Square Sales Sync to update sales records with vendor data</li>
                      )}
                      <li>After fixes, test the 6-week sales analysis vendor dropdown</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-red-600">
              Failed to load debug data
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button onClick={runDebug} disabled={loading}>
            🔄 Run Debug Again
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}