import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SquareAuthStatus {
  isAuthenticated: boolean;
  requiresAuth: boolean;
  message: string;
}

export function useSquareAuthStatus() {
  return useQuery<SquareAuthStatus>({
    queryKey: ['square', 'auth', 'status'],
    queryFn: async () => {
      console.log('🔍 Checking Square auth status...');
      const response = await fetch('/api/square/auth', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to check Square authentication status');
      }
      const data = await response.json();
      console.log('🔍 Square auth status response:', data);
      return data.data;
    },
    refetchInterval: 5000, // Check every 5 seconds (more frequent)
    staleTime: 0, // Always fetch fresh data
    retry: 3,
  });
}

export function useSquareReAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log('🔄 Re-authenticating Square...');
      const response = await fetch('/api/square/auth', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.error('❌ Square re-auth failed:', response.status, response.statusText);
        throw new Error('Failed to re-authenticate Square');
      }
      
      const data = await response.json();
      console.log('✅ Square re-auth response:', data);
      return data.data;
    },
    onSuccess: (data) => {
      console.log('✅ Square re-auth successful, invalidating queries');
      // Invalidate all Square queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['square'] });
    },
    onError: (error) => {
      console.error('❌ Square re-auth error:', error);
    },
  });
}