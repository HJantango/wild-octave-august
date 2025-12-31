'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
  });
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      setAuthState({
        isAuthenticated: response.ok,
        isLoading: false,
      });
    } catch {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
      });
      
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return {
    ...authState,
    logout,
    refresh: checkAuthStatus,
  };
}