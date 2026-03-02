'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export default function VendorQuickFixPage() {
  const toast = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [fixResult, setFixResult] = useState<any>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/admin/force-vendor-update?action=analyze');
      const data = await response.json();
      
      if (data.success || data.data) {
        setAnalysisResult(data.data);
        const heapsCount = data.data?.heapsGoodMatches?.length || 0;
        toast.success('Analysis Complete', `Found ${heapsCount} Heaps Good items that need vendor assignment`);
      } else {
        toast.error('Error', data.error?.message || 'Failed to analyze vendors');
      }
    } catch (error) {
      toast.error('Error', 'Failed to analyze vendors');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFix = async () => {
    setIsFixing(true);
    try {
      const response = await fetch('/api/admin/force-vendor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix-patterns' }),
      });
      const data = await response.json();
      
      if (data.success || data.data) {
        setFixResult(data.data);
        const heapsUpdate = data.data?.heapsGoodUpdate;
        const message = heapsUpdate 
          ? `Fixed ${heapsUpdate.recordsUpdated} Heaps Good records!`
          : `Updated ${data.data?.totalUpdated || 0} vendor assignments`;
        toast.success('Fix Complete!', message);
      } else {
        toast.error('Error', data.error?.message || 'Failed to fix vendors');
      }
    } catch (error) {
      toast.error('Error', 'Failed to fix vendors');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">⚡ Quick Vendor Fix</h1>
          <p className="text-orange-100">
            Fix missing vendor names in sales records using item name patterns
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🔍 Step 1: Analyze Missing Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    This will scan sales records for items that should have vendors but don't,
                    focusing on obvious patterns like "Heaps Good" in item names.
                  </p>
                </div>
                
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isAnalyzing ? 'Analyzing...' : '🔍 Analyze Missing Vendors'}
                </Button>
                
                {analysisResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Analysis Results:</h3>
                    <ul className="space-y-1 text-sm">
                      <li>📊 Items missing vendors: {analysisResult.totalMissingVendors}</li>
                      <li>🎯 Pattern matches found: {analysisResult.patternMatches?.length || 0}</li>
                      <li>🥤 Heaps Good items: {analysisResult.heapsGoodMatches?.length || 0}</li>
                    </ul>
                    
                    {analysisResult.heapsGoodMatches?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-green-700">Heaps Good items found:</p>
                        <div className="text-xs text-gray-600 max-h-20 overflow-y-auto">
                          {analysisResult.heapsGoodMatches.slice(0, 5).map((item: any, i: number) => (
                            <div key={i}>• {item.itemName}</div>
                          ))}
                          {analysisResult.heapsGoodMatches.length > 5 && (
                            <div>... and {analysisResult.heapsGoodMatches.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔧 Step 2: Fix Vendor Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    This will automatically assign vendors to sales records based on item names:
                  </p>
                  <ul className="text-xs text-orange-600 mt-2 space-y-1">
                    <li>• "Heaps Good" items → "Heaps Good" vendor</li>
                    <li>• "Weleda" items → "Weleda" vendor</li>
                    <li>• "Ere Perez" items → "Ere Perez" vendor</li>
                    <li>• And more...</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={handleFix} 
                  disabled={isFixing || !analysisResult}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isFixing ? 'Fixing...' : '🔧 Fix Vendor Assignments'}
                </Button>
                
                {fixResult && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-2">✅ Fix Complete!</h3>
                    <ul className="space-y-1 text-sm text-green-700">
                      <li>📊 Total records updated: {fixResult.totalUpdated}</li>
                      {fixResult.heapsGoodUpdate && (
                        <li>🥤 Heaps Good records: {fixResult.heapsGoodUpdate.recordsUpdated}</li>
                      )}
                    </ul>
                    
                    {fixResult.updates?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-green-700">Vendors fixed:</p>
                        <div className="text-xs text-green-600 max-h-20 overflow-y-auto">
                          {fixResult.updates.map((update: any, i: number) => (
                            <div key={i}>• {update.vendor}: {update.recordsUpdated} records</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {fixResult && (
          <Card>
            <CardHeader>
              <CardTitle>🎉 Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-800 mb-2">Test the Fix:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                    <li>Go to your <strong>6-week sales analysis</strong></li>
                    <li><strong>Refresh the page</strong> (F5)</li>
                    <li>Check the vendor dropdown - <strong>"Heaps Good" should now appear!</strong></li>
                    <li>Select "Heaps Good" and run analysis to see the products</li>
                  </ol>
                </div>
                
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-800 mb-2">Success! 🎯</p>
                  <p className="text-sm text-green-700">
                    The vendor assignments have been updated directly in the sales records.
                    This bypasses the Square catalog sync issues and should immediately
                    make vendors available in your dropdown.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}