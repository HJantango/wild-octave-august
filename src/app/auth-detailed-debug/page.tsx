'use client';

import { useState } from 'react';

export default function AuthDetailedDebugPage() {
  const [email, setEmail] = useState('heathjansse@gmail.com');
  const [password, setPassword] = useState('Nintendo:)2100w');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runDebug = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/debug/auth-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setResult(data.data || data);

    } catch (error: any) {
      setResult({
        error: true,
        message: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepIcon = (step: string) => {
    if (step.includes('✅')) return '✅';
    if (step.includes('❌')) return '❌';
    if (step.includes('🔍')) return '🔍';
    if (step.includes('🔐')) return '🔐';
    return '🔧';
  };

  const getStepColor = (step: string) => {
    if (step.includes('✅')) return 'text-green-700 bg-green-50 border-green-200';
    if (step.includes('❌')) return 'text-red-700 bg-red-50 border-red-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">🔍 Detailed Authentication Debug</h1>
          <p className="text-red-100">
            Step-by-step analysis of authentication failure
          </p>
        </div>

        {/* Test Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Authentication</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          
          <button
            onClick={runDebug}
            disabled={isLoading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 font-semibold"
          >
            {isLoading ? 'Running Detailed Debug...' : '🔍 Debug Authentication'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Steps */}
            {result.steps && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">🔍 Debug Steps</h2>
                <div className="space-y-2">
                  {result.steps.map((step: string, i: number) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border text-sm ${getStepColor(step)}`}
                    >
                      <span className="mr-2">{getStepIcon(step)}</span>
                      {step.replace(/^(✅|❌|🔍|🔐)\s*/, '')}
                    </div>
                  ))}
                </div>
                
                {result.overallAssessment && (
                  <div className={`mt-4 p-4 rounded-lg border-2 text-center font-semibold ${
                    result.overallAssessment.includes('✅') 
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-red-100 border-red-300 text-red-800'
                  }`}>
                    {result.overallAssessment}
                  </div>
                )}
              </div>
            )}

            {/* User Info */}
            {result.userInfo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">👤 User Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {result.userInfo.id}</div>
                    <div><strong>Email:</strong> {result.userInfo.email}</div>
                    <div><strong>Name:</strong> {result.userInfo.name || 'N/A'}</div>
                    <div><strong>Role:</strong> {result.userInfo.role}</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div><strong>Active:</strong> {result.userInfo.isActive ? '✅ Yes' : '❌ No'}</div>
                    <div><strong>Has Password:</strong> {result.userInfo.hasPassword ? '✅ Yes' : '❌ No'}</div>
                    <div><strong>Password Length:</strong> {result.userInfo.passwordLength}</div>
                    <div><strong>Created:</strong> {new Date(result.userInfo.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Password Debug */}
            {result.passwordInfo && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">🔐 Password Debug</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <div className="text-sm space-y-2">
                    <div><strong>Provided Password:</strong> {result.passwordInfo.providedPassword}</div>
                    <div><strong>Provided Length:</strong> {result.passwordInfo.providedPasswordLength}</div>
                    <div><strong>Stored Hash Length:</strong> {result.passwordInfo.storedHashLength}</div>
                    <div><strong>Hash Preview:</strong> {result.passwordInfo.hashStartsWith}</div>
                    {result.passwordError && (
                      <div className="text-red-600"><strong>Error:</strong> {result.passwordError}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Raw Result */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📋 Raw Debug Data</h2>
              <pre className="bg-gray-50 p-4 rounded border text-xs overflow-auto max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}