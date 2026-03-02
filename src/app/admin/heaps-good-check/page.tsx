'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HeapsGoodCheckPage() {
  const [vendorsData, setVendorsData] = useState<any>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check vendors endpoint
      const vendorsResponse = await fetch('/api/vendors-with-sales');
      const vendorsData = await vendorsResponse.json();
      setVendorsData(vendorsData);

      // Check debug endpoint
      const debugResponse = await fetch('/api/debug/heaps-good-debug');
      const debugData = await debugResponse.json();
      setDebugData(debugData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const heapsGoodVendors = vendorsData?.data?.vendors?.filter((v: any) => 
    v.name.toLowerCase().includes('heaps')
  ) || [];

  const heapsGoodSales = debugData?.data?.heapsGoodSales || [];
  const allSalesVendors = debugData?.data?.salesVendors || [];
  const heapsInSales = allSalesVendors.filter((v: any) => 
    v.vendor?.toLowerCase().includes('heaps')
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">🥤 Heaps Good Debug Check</h1>
          <p className="text-green-100">
            Checking why Heaps Good isn't appearing in vendor dropdown
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vendor Dropdown Data */}
          <Card>
            <CardHeader>
              <CardTitle>🏪 Vendor Dropdown Data</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div>Loading...</div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-sm font-medium">Total Vendors: {vendorsData?.data?.vendors?.length || 0}</div>
                    <div className="text-sm text-gray-600">Database: {vendorsData?.data?.summary?.databaseVendors || 0}</div>
                    <div className="text-sm text-gray-600">Sales Only: {vendorsData?.data?.summary?.salesOnlyVendors || 0}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-2">Heaps Good Found in Dropdown:</div>
                    {heapsGoodVendors.length > 0 ? (
                      <div className="space-y-1">
                        {heapsGoodVendors.map((vendor: any, i: number) => (
                          <div key={i} className="text-sm p-2 bg-green-100 border border-green-200 rounded">
                            ✅ <strong>{vendor.name}</strong> ({vendor.source})
                            {vendor.salesCount && ` - ${vendor.salesCount} sales`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm p-2 bg-red-100 border border-red-200 rounded text-red-700">
                        ❌ No Heaps Good vendors found in dropdown data
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Data */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Sales Data</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div>Loading...</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-2">Heaps Good in Sales Vendors:</div>
                    {heapsInSales.length > 0 ? (
                      <div className="space-y-1">
                        {heapsInSales.map((vendor: any, i: number) => (
                          <div key={i} className="text-sm p-2 bg-blue-100 border border-blue-200 rounded">
                            📊 <strong>{vendor.vendor}</strong> ({vendor.count} records)
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm p-2 bg-yellow-100 border border-yellow-200 rounded text-yellow-700">
                        ⚠️ No Heaps Good found in sales vendor list
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Recent Heaps Good Sales:</div>
                    {heapsGoodSales.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {heapsGoodSales.slice(0, 5).map((sale: any, i: number) => (
                          <div key={i} className="text-xs p-2 bg-green-50 border rounded">
                            <div><strong>{sale.itemName}</strong></div>
                            <div>Vendor: {sale.vendorName || 'NULL'}</div>
                            <div>{sale.date} - {sale.quantitySold} sold</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm p-2 bg-red-100 border border-red-200 rounded text-red-700">
                        ❌ No recent Heaps Good sales found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🔧 Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {heapsGoodVendors.length === 0 && heapsInSales.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="font-medium text-yellow-800">🚨 Issue Found:</div>
                  <div className="text-yellow-700">
                    No Heaps Good data found anywhere. This means either:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Square sales sync hasn't been run since the vendor extraction fix</li>
                      <li>The vendor name in Square is different (e.g., "Heaps Good Food" vs "Heaps Good")</li>
                      <li>Heaps Good products aren't properly assigned vendors in Square</li>
                    </ul>
                  </div>
                </div>
              )}
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="font-medium text-blue-800">💡 Recommended Actions:</div>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-blue-700">
                  <li>Run Square Sales Sync (Admin → Square Sync → Sync Sales)</li>
                  <li>Check Square POS - verify exact vendor name assigned to products</li>
                  <li>Refresh this page to see if Heaps Good appears</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={loadData} disabled={loading}>
            🔄 Refresh Data
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}