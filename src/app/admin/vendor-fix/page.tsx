'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface FixResult {
  vendorsCreated: number;
  itemsFixed: number;
  vendorsProcessed: number;
  message?: string;
}

export default function VendorFixPage() {
  const toast = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/admin/fix-vendor-assignments?action=analyze');
      const data = await response.json();
      
      if (data.success || data.data) {
        setAnalysisResult(data.data);
        toast.success('Analysis Complete', `Found ${data.data?.summary?.itemsNeedingVendors || 0} items needing vendor assignment`);
      } else {
        toast.error('Error', data.error?.message || 'Failed to analyze vendor assignments');
      }
    } catch (error) {
      toast.error('Error', 'Failed to analyze vendor assignments');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFix = async () => {
    setIsFixing(true);
    try {
      const response = await fetch('/api/admin/fix-vendor-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix' }),
      });
      const data = await response.json();
      
      if (data.success || data.data) {
        setFixResult(data.data);
        toast.success('Fix Complete!', `Created ${data.data?.summary?.vendorsCreated || 0} vendors, fixed ${data.data?.summary?.itemsFixed || 0} items`);
      } else {
        toast.error('Error', data.error?.message || 'Failed to fix vendor assignments');
      }
    } catch (error) {
      toast.error('Error', 'Failed to fix vendor assignments');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">🔧 Vendor Assignment Fix</h1>
          <p className="text-blue-100">
            Fix missing vendor assignments so vendors like "Heaps Good" appear in sales analysis
          </p>
        </div>

        {/* Analysis Section */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Analyze What Needs Fixing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAnalyzing ? 'Analyzing...' : '🔍 Analyze Vendor Coverage'}
              </Button>
              
              {analysisResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Analysis Results:</h3>
                  <ul className="space-y-1">
                    <li>📊 Total sales items: {analysisResult.summary?.totalSalesItems || 0}</li>
                    <li>❌ Items needing vendors: {analysisResult.summary?.itemsNeedingVendors || 0}</li>
                    <li>🥤 Heaps Good items: {analysisResult.summary?.heapsGoodItems || 0}</li>
                  </ul>
                  {analysisResult.examples?.heapsGoodItems?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Heaps Good items found:</p>
                      <ul className="text-sm text-gray-600">
                        {analysisResult.examples.heapsGoodItems.map((item: any, i: number) => (
                          <li key={i}>• {item.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fix Section */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Fix Vendor Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm">
                  ⚠️ This will create missing vendors and assign them to items based on sales data.
                  It's safe to run multiple times.
                </p>
              </div>
              
              <Button 
                onClick={handleFix} 
                disabled={isFixing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isFixing ? 'Fixing...' : '🔧 Fix Vendor Assignments'}
              </Button>
              
              {fixResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">✅ Fix Complete!</h3>
                  <ul className="space-y-1 text-green-700">
                    <li>🏪 Vendors created: {fixResult.vendorsCreated}</li>
                    <li>🔗 Items fixed: {fixResult.itemsFixed}</li>
                    <li>📦 Vendors processed: {fixResult.vendorsProcessed}</li>
                  </ul>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm font-medium text-blue-800">Next Steps:</p>
                    <ol className="text-sm text-blue-700 list-decimal list-inside">
                      <li>Go to your sales analysis page</li>
                      <li>Refresh the page (F5)</li>
                      <li>Check the vendor dropdown - "Heaps Good" should now appear!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}