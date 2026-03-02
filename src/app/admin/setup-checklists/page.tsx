'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SetupChecklistsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runSetup = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/admin/setup-checklists', {
        method: 'POST',
      });
      
      const data = await response.json();
      setResult(data);
      
    } catch (error) {
      setResult({
        success: false,
        error: { message: 'Failed to setup checklists' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">🔧 Setup Checklist System</h1>
          <p className="text-green-100">
            Initialize the database and seed checklist templates
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checklist System Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">What this will do:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✅ Create database tables for checklists</li>
                <li>✅ Add Kitchen/Back tasks (14 items)</li>
                <li>✅ Add Front of House tasks (25 items)</li>
                <li>✅ Add Barista tasks (7 items)</li>
                <li>✅ Set up daily/weekly/specific day scheduling</li>
              </ul>
            </div>

            <Button 
              onClick={runSetup} 
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Setting up...' : '🚀 Setup Checklist System'}
            </Button>

            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                {result.success ? (
                  <div>
                    <h3 className="font-semibold text-green-800 mb-2">✅ Setup Complete!</h3>
                    
                    {result.data?.steps && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-green-700 mb-1">Completed Steps:</p>
                        <ul className="text-sm text-green-600 space-y-1">
                          {result.data.steps.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.data?.nextSteps && (
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">Next Steps:</p>
                        <ul className="text-sm text-green-600 space-y-1">
                          {result.data.nextSteps.map((step: string, i: number) => (
                            <li key={i}>• {step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex gap-3">
                      <Button 
                        onClick={() => window.location.href = '/checklists'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        📋 View Checklists
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/checklists/manage'}
                        variant="outline"
                      >
                        ⚙️ Manage Templates
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">❌ Setup Failed</h3>
                    <p className="text-sm text-red-600">
                      {result.error?.message || 'Unknown error occurred'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-semibold text-red-800 mb-2">🍳 Kitchen / Back</h3>
                <div className="text-sm text-red-700 space-y-1">
                  <div>• Clean cooking utensils</div>
                  <div>• Sweep / Mop floors</div>
                  <div>• Clean smoothie/juice machine</div>
                  <div>• Clean toilets (Wed & Sat)</div>
                  <div className="text-gray-600">...and 10 more tasks</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">🏪 Front of House</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• Clean bulk section</div>
                  <div>• Restock drinks fridge</div>
                  <div>• Fridge dates & temps</div>
                  <div>• Clean fruit & veg fridge (Tue)</div>
                  <div className="text-gray-600">...and 21 more tasks</div>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">☕ Barista</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <div>• Pack down machine</div>
                  <div>• Clean coffee bench</div>
                  <div>• Empty ice bucket</div>
                  <div>• Reset bells & tills</div>
                  <div className="text-gray-600">...and 3 more tasks</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}