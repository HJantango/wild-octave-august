'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SalesSummary {
  overview: {
    totalRevenue: number;
    totalQuantity: number;
    reportCount: number;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  topCategories: Array<{
    category: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemName: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
}

export interface SalesTimeSeries {
  timeSeries: Array<{
    date: string;
    revenue: number;
    quantity: number;
  }>;
  categoryBreakdown: Array<{
    date: string;
    categories: Array<{
      category: string;
      revenue: number;
      quantity: number;
    }>;
  }>;
}

export interface SalesFilters {
  category?: string;
  itemName?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useSalesSummary(filters: SalesFilters = {}) {
  return useQuery({
    queryKey: ['sales', 'summary', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (filters.category) searchParams.set('category', filters.category);
      if (filters.itemName) searchParams.set('itemName', filters.itemName);
      if (filters.startDate) searchParams.set('startDate', filters.startDate.toISOString());
      if (filters.endDate) searchParams.set('endDate', filters.endDate.toISOString());

      // Try to get Square data first for real-time information
      try {
        const squareParams = new URLSearchParams();
        if (filters.startDate) squareParams.set('startDate', filters.startDate.toISOString());
        if (filters.endDate) squareParams.set('endDate', filters.endDate.toISOString());
        
        const squareResponse = await fetch(`/api/square/realtime?type=sales-summary&${squareParams}`);
        if (squareResponse.ok) {
          const squareResult = await squareResponse.json();
          const squareData = squareResult.data;
          
          // Convert Square data to match SalesSummary interface
          const convertedData: SalesSummary = {
            overview: {
              totalRevenue: squareData.overview.totalRevenue,
              totalQuantity: squareData.overview.totalQuantity,
              reportCount: squareData.overview.totalOrders || 1, // Use totalOrders or default to 1
              dateRange: squareData.overview.dateRange
            },
            topCategories: squareData.topCategories.map((cat: any) => ({
              category: cat.category,
              revenue: cat.revenue,
              quantity: cat.quantity,
              percentage: cat.percentage
            })),
            topItems: squareData.topItems.map((item: any) => ({
              itemName: item.itemName,
              revenue: item.revenue,
              quantity: item.quantity,
              percentage: item.percentage
            }))
          };
          
          console.log('📊 Using real-time Square data for sales summary');
          return convertedData;
        }
      } catch (error) {
        console.log('⚠️ Square data unavailable, falling back to uploaded sales data');
      }

      // Fall back to uploaded sales data
      const response = await fetch(`/api/sales/summary?${searchParams}`);
      if (!response.ok) {
        // If no uploaded data and no Square data, return empty structure
        console.log('⚠️ No uploaded sales data available - database appears to be clean');
        return {
          overview: {
            totalRevenue: 0,
            totalQuantity: 0,
            reportCount: 0,
            dateRange: { start: null, end: null }
          },
          topCategories: [],
          topItems: []
        } as SalesSummary;
      }
      
      const result = await response.json();
      console.log('📊 Using uploaded sales data (fallback)');
      return result.data as SalesSummary;
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  });
}

export function useSalesTimeSeries(filters: SalesFilters = {}) {
  return useQuery({
    queryKey: ['sales', 'timeseries', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (filters.category) searchParams.set('category', filters.category);
      if (filters.itemName) searchParams.set('itemName', filters.itemName);
      if (filters.startDate) searchParams.set('startDate', filters.startDate.toISOString());
      if (filters.endDate) searchParams.set('endDate', filters.endDate.toISOString());

      // Try to get Square orders data first for real-time information
      try {
        const squareParams = new URLSearchParams();
        if (filters.startDate) squareParams.set('startDate', filters.startDate.toISOString());
        if (filters.endDate) squareParams.set('endDate', filters.endDate.toISOString());
        
        const squareResponse = await fetch(`/api/square/realtime?type=orders&${squareParams}`);
        if (squareResponse.ok) {
          const squareResult = await squareResponse.json();
          const squareOrders = squareResult.data.orders;
          
          // Convert Square orders to time series data
          const timeSeriesMap = new Map<string, { revenue: number; quantity: number; categories: Map<string, { revenue: number; quantity: number }> }>();
          
          squareOrders.forEach((order: any) => {
            const date = new Date(order.createdAt).toISOString().split('T')[0]; // Get YYYY-MM-DD
            
            if (!timeSeriesMap.has(date)) {
              timeSeriesMap.set(date, { 
                revenue: 0, 
                quantity: 0, 
                categories: new Map() 
              });
            }
            
            const dayData = timeSeriesMap.get(date)!;
            dayData.revenue += order.totalAmount;
            
            order.items.forEach((item: any) => {
              dayData.quantity += item.quantity;
              
              // Use a simple category mapping
              const category = 'Square Sales'; // You might want to enhance this based on item data
              if (!dayData.categories.has(category)) {
                dayData.categories.set(category, { revenue: 0, quantity: 0 });
              }
              const catData = dayData.categories.get(category)!;
              catData.revenue += item.amount;
              catData.quantity += item.quantity;
            });
          });
          
          // Convert to the expected format
          const timeSeries = Array.from(timeSeriesMap.entries()).map(([date, data]) => ({
            date,
            revenue: data.revenue,
            quantity: data.quantity
          })).sort((a, b) => a.date.localeCompare(b.date));
          
          const categoryBreakdown = Array.from(timeSeriesMap.entries()).map(([date, data]) => ({
            date,
            categories: Array.from(data.categories.entries()).map(([category, catData]) => ({
              category,
              revenue: catData.revenue,
              quantity: catData.quantity
            }))
          })).sort((a, b) => a.date.localeCompare(b.date));
          
          const convertedData: SalesTimeSeries = {
            timeSeries,
            categoryBreakdown
          };
          
          console.log('📈 Using real-time Square data for time series');
          return convertedData;
        }
      } catch (error) {
        console.log('⚠️ Square time series data unavailable, falling back to uploaded sales data');
      }

      // Fall back to uploaded sales data
      const response = await fetch(`/api/sales/timeseries?${searchParams}`);
      if (!response.ok) {
        // If no uploaded data and no Square data, return empty structure
        console.log('⚠️ No uploaded time series data available - database appears to be clean');
        return {
          timeSeries: [],
          categoryBreakdown: []
        } as SalesTimeSeries;
      }
      
      const result = await response.json();
      console.log('📈 Using uploaded sales time series data (fallback)');
      return result.data as SalesTimeSeries;
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  });
}

export function useUploadSalesReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sales/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload sales report');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}