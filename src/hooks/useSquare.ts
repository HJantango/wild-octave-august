'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SquareFilters {
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
}

export interface SquareSyncOptions {
  syncType?: 'catalog' | 'orders' | 'payments' | 'full';
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
}

export interface SquareRealtimeData {
  type: string;
  lastSync: string;
  [key: string]: any;
}

export interface SquareSalesSummary {
  type: 'sales-summary';
  overview: {
    totalRevenue: number;
    totalQuantity: number;
    totalOrders: number;
    totalPayments: number;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  topItems: Array<{
    itemName: string;
    quantity: number;
    revenue: number;
    orders: number;
    percentage: number;
  }>;
  topCategories: Array<{
    category: string;
    quantity: number;
    revenue: number;
    orders: number;
    percentage: number;
  }>;
  realtimeMetrics: {
    averageOrderValue: number;
    itemsPerOrder: number;
    paymentSuccessRate: number;
  };
  lastSync: string;
}

export function useSquareRealtimeData(dataType: 'catalog' | 'orders' | 'payments' | 'sales-summary', filters: SquareFilters = {}) {
  return useQuery({
    queryKey: ['square', 'realtime', dataType, filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('type', dataType);
      
      if (filters.startDate) {
        searchParams.set('startDate', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        searchParams.set('endDate', filters.endDate.toISOString());
      }
      if (filters.locationId) {
        searchParams.set('locationId', filters.locationId);
      }

      const response = await fetch(`/api/square/realtime?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Square real-time data');
      }
      
      const result = await response.json();
      return result.data as SquareRealtimeData;
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time data
    staleTime: 25000, // Consider data stale after 25 seconds
  });
}

export function useSquareSalesSummary(filters: SquareFilters = {}) {
  return useQuery({
    queryKey: ['square', 'sales-summary', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('type', 'sales-summary');
      
      if (filters.startDate) {
        searchParams.set('startDate', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        searchParams.set('endDate', filters.endDate.toISOString());
      }
      if (filters.locationId) {
        searchParams.set('locationId', filters.locationId);
      }

      const response = await fetch(`/api/square/realtime?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Square sales summary');
      }
      
      const result = await response.json();
      return result.data as SquareSalesSummary;
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 50000, // Consider data stale after 50 seconds
  });
}

export function useSquareSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: SquareSyncOptions = {}) => {
      const response = await fetch('/api/square/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncType: options.syncType || 'orders',
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString(),
          locationId: options.locationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to sync Square data');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all Square-related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['square'] });
      // Also invalidate regular sales queries since we may have synced new data
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      
      console.log('✅ Square sync completed:', data);
    },
    onError: (error) => {
      console.error('❌ Square sync failed:', error);
    }
  });
}

// Hook to combine Square real-time data with existing sales data
export function useEnhancedSalesSummary(filters: SquareFilters = {}) {
  const squareData = useSquareSalesSummary(filters);
  
  return {
    ...squareData,
    data: squareData.data ? {
      // Transform Square data to match existing SalesSummary interface
      overview: {
        totalRevenue: squareData.data.overview.totalRevenue,
        totalQuantity: squareData.data.overview.totalQuantity,
        reportCount: squareData.data.overview.totalOrders,
        dateRange: {
          start: squareData.data.overview.dateRange.start,
          end: squareData.data.overview.dateRange.end,
        },
      },
      topCategories: squareData.data.topCategories.map(cat => ({
        category: cat.category,
        revenue: cat.revenue,
        quantity: cat.quantity,
        percentage: cat.percentage,
      })),
      topItems: squareData.data.topItems.map(item => ({
        itemName: item.itemName,
        revenue: item.revenue,
        quantity: item.quantity,
        percentage: item.percentage,
      })),
      // Additional real-time metrics from Square
      realtimeMetrics: squareData.data.realtimeMetrics,
      lastSync: squareData.data.lastSync,
    } : undefined
  };
}

// Hook for Square catalog management
export function useSquareCatalog() {
  return useQuery({
    queryKey: ['square', 'catalog'],
    queryFn: async () => {
      const response = await fetch('/api/square/realtime?type=catalog');
      if (!response.ok) {
        throw new Error('Failed to fetch Square catalog');
      }
      
      const result = await response.json();
      return result.data;
    },
    staleTime: 300000, // Catalog changes less frequently, so 5 minutes is ok
  });
}

// Hook for real-time order monitoring
export function useSquareOrders(filters: SquareFilters = {}) {
  return useQuery({
    queryKey: ['square', 'orders', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('type', 'orders');
      
      if (filters.startDate) {
        searchParams.set('startDate', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        searchParams.set('endDate', filters.endDate.toISOString());
      }
      if (filters.locationId) {
        searchParams.set('locationId', filters.locationId);
      }

      const response = await fetch(`/api/square/realtime?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Square orders');
      }
      
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds for order monitoring
    staleTime: 10000,
  });
}