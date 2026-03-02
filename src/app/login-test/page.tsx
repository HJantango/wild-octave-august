'use client';

import { useState } from 'react';

export default function LoginTestPage() {
  const [email, setEmail] = useState('heathjansse@gmail.com');
  const [password, setPassword] = useState('Nintendo:)2100w');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [sessionCheck, setSessionCheck] = useState<any>(null);

  const testLogin = async () => {
    setIsLoading(true);
    setResponse(null);
    
    try {
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();
      
      setResponse({
        status: loginResponse.status,
        statusText: loginResponse.statusText,
        ok: loginResponse.ok,
        data: loginData,
        headers: Object.fromEntries(loginResponse.headers.entries()),
      });

      // If login succeeded, test session
      if (loginResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
        await checkSession();
      }

    } catch (error: any) {
      setResponse({
        error: true,
        message: error.message,
        stack: error.stack,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const sessionResponse = await fetch('/api/auth/session');
      const sessionData = await sessionResponse.json();
      
      setSessionCheck({
        status: sessionResponse.status,
        ok: sessionResponse.ok,
        data: sessionData,
      });
    } catch (error: any) {
      setSessionCheck({
        error: true,
        message: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">🔐 Login Test & Debug</h1>
          <p className="text-purple-100">
            Detailed login testing to diagnose authentication issues
          </p>
        </div>

        {/* Login Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Login</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={testLogin}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test Login'}
              </button>
              
              <button
                onClick={checkSession}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
              >
                Check Current Session
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/auth-debug'}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 text-sm"
              >
                🔍 Auth Debug Page
              </button>
              
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 text-sm"
              >
                🔐 Normal Login Page
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 text-sm"
              >
                🏠 Try Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Login Response */}
        {response && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Login Response</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-sm ${
                    response.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {response.status} {response.statusText}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Success:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-sm ${
                    response.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {response.ok ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
              
              <div className="text-sm">
                <div className="font-medium text-gray-700 mb-2">Response Data:</div>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-40">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Session Check */}
        {sessionCheck && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Session Check</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm">
                <div className="font-medium text-gray-700 mb-2">Session Data:</div>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-40">
                  {JSON.stringify(sessionCheck, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}