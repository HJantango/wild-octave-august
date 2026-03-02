'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthStatus {
  totalUsers: number;
  users: any[];
  heathUserExists: boolean;
  heathUserActive: boolean;
  message: string;
}

export default function AuthDebugPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/fix-auth?action=check');
      const data = await response.json();
      if (data.success || data.data) {
        setAuthStatus(data.data);
      } else {
        setMessage('Error checking auth: ' + data.error?.message);
      }
    } catch (error) {
      setMessage('Failed to check auth status');
    } finally {
      setLoading(false);
    }
  };

  const createHeathUser = async () => {
    setLoading(true);
    setMessage('Creating Heath admin user...');
    try {
      const response = await fetch('/api/admin/fix-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-heath' }),
      });
      const data = await response.json();
      if (data.success || data.data) {
        setMessage('✅ Heath admin user created! Try logging in now.');
        checkAuth();
      } else {
        setMessage('❌ Error: ' + data.error?.message);
      }
    } catch (error) {
      setMessage('❌ Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const createTestUser = async () => {
    setLoading(true);
    setMessage('Creating test user...');
    try {
      const response = await fetch('/api/admin/fix-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-test' }),
      });
      const data = await response.json();
      if (data.success || data.data) {
        setMessage('✅ Test user created! Login: test@wildoctave.com / test123');
        checkAuth();
      } else {
        setMessage('❌ Error: ' + data.error?.message);
      }
    } catch (error) {
      setMessage('❌ Failed to create test user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">🔐 Authentication Debug</h1>
          <p className="text-red-100">
            Diagnose and fix login issues
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>👥 User Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !authStatus ? (
                <div>Loading...</div>
              ) : authStatus ? (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="font-medium">Total Users: {authStatus.totalUsers}</div>
                    <div className="text-sm text-gray-600">{authStatus.message}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="font-medium">Heath's Account:</div>
                    <div className={`p-2 rounded ${authStatus.heathUserExists ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
                      <div className={authStatus.heathUserExists ? 'text-green-700' : 'text-red-700'}>
                        {authStatus.heathUserExists ? '✅ Exists' : '❌ Not Found'}
                      </div>
                      {authStatus.heathUserExists && (
                        <div className={authStatus.heathUserActive ? 'text-green-600' : 'text-red-600'}>
                          {authStatus.heathUserActive ? 'Active' : 'Inactive'}
                        </div>
                      )}
                    </div>
                  </div>

                  {authStatus.users.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">All Users:</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {authStatus.users.map((user: any) => (
                          <div key={user.id} className="text-sm p-2 bg-gray-100 rounded">
                            <div><strong>{user.email}</strong> ({user.role})</div>
                            <div className="text-gray-600">
                              {user.name} - {user.isActive ? 'Active' : 'Inactive'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">Failed to load auth status</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔧 Fix Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {authStatus && !authStatus.heathUserExists && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <div className="font-medium text-red-800 mb-2">🚨 Heath's User Missing</div>
                    <div className="text-sm text-red-600 mb-3">
                      The main admin user doesn't exist. This will create it with your usual credentials.
                    </div>
                    <Button onClick={createHeathUser} disabled={loading} className="bg-red-600 hover:bg-red-700">
                      {loading ? 'Creating...' : '👤 Create Heath Admin User'}
                    </Button>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <div className="font-medium text-blue-800 mb-2">🧪 Test User</div>
                  <div className="text-sm text-blue-600 mb-3">
                    Create a simple test user for debugging login issues.
                  </div>
                  <Button onClick={createTestUser} disabled={loading} variant="outline">
                    {loading ? 'Creating...' : '🔬 Create Test User'}
                  </Button>
                </div>

                {authStatus?.heathUserExists && authStatus?.heathUserActive && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded">
                    <div className="font-medium text-green-800 mb-2">✅ Ready to Login</div>
                    <div className="text-sm text-green-600 mb-2">
                      Heath's admin user exists and is active. Login credentials:
                    </div>
                    <div className="text-sm font-mono bg-white p-2 rounded border">
                      Email: heathjansse@gmail.com<br/>
                      Password: Nintendo:)2100w
                    </div>
                    <div className="mt-2">
                      <a href="/login" className="text-blue-600 hover:underline">
                        → Go to Login Page
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {message && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-yellow-800">{message}</div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex gap-4">
          <Button onClick={checkAuth} disabled={loading} variant="outline">
            🔄 Refresh Status
          </Button>
        </div>
      </div>
    </div>
  );
}