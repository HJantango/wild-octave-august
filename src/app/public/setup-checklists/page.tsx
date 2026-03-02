'use client';

import { useState } from 'react';

export default function PublicSetupChecklistsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runSetup = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/public/setup-checklists', {
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">🔧 Setup Wild Octave Checklists</h1>
          <p className="text-green-100">
            Public setup page - no login required
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Initialize Checklist System</h2>
          
          <div className="space-y-4">
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

            <button 
              onClick={runSetup} 
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {isLoading ? 'Setting up...' : '🚀 Setup Checklist System'}
            </button>

            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                {result.success ? (
                  <div>
                    <h3 className="font-semibold text-green-800 mb-2">
                      {result.data?.status === 'already_exists' ? '✅ System Already Set Up!' : '✅ Setup Complete!'}
                    </h3>
                    
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

                    {result.data?.templatesCreated && (
                      <div className="mb-4 text-sm text-green-600">
                        <p><strong>Created:</strong> {result.data.templatesCreated} templates with {result.data.itemsCreated} total tasks</p>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-green-700">Next Steps:</p>
                      <ul className="text-sm text-green-600 space-y-1">
                        <li>• Navigate to <strong>/checklists</strong> to view weekly tasks</li>
                        <li>• Use <strong>/checklists/manage</strong> to edit templates</li>
                        <li>• Staff can mark tasks as complete</li>
                        <li>• Print weekly layouts for lamination</li>
                      </ul>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <a 
                        href="/checklists"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        📋 View Checklists
                      </a>
                      <a 
                        href="/checklists/manage"
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                      >
                        ⚙️ Manage Templates
                      </a>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">❌ Setup Failed</h3>
                    <p className="text-sm text-red-600">
                      {result.error?.message || 'Unknown error occurred'}
                    </p>
                    <div className="mt-2 text-xs text-red-500">
                      This might be a database connectivity issue. Try again in a few minutes.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Checklist Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">🍳 Kitchen / Back (14 tasks)</h3>
              <div className="text-sm text-red-700 space-y-1">
                <div>• Clean cooking utensils</div>
                <div>• Sweep / Mop floors</div>
                <div>• Clean smoothie/juice machine</div>
                <div>• Clean toilets (Wed & Sat)</div>
                <div>• Cutlery canisters (Monday)</div>
                <div className="text-gray-600">...and 9 more daily tasks</div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">🏪 Front of House (25 tasks)</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <div>• Clean bulk section</div>
                <div>• Restock drinks fridge</div>
                <div>• Fridge dates & temps</div>
                <div>• Clean fruit & veg fridge (Tue)</div>
                <div>• Clean fruit & veg shelves (Thu)</div>
                <div className="text-gray-600">...and 20 more daily tasks</div>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">☕ Barista (7 tasks)</h3>
              <div className="text-sm text-green-700 space-y-1">
                <div>• Pack down machine</div>
                <div>• Clean coffee bench</div>
                <div>• Empty ice bucket</div>
                <div>• Reset bells & tills</div>
                <div>• Clean milk containers</div>
                <div className="text-gray-600">...and 2 more tasks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}