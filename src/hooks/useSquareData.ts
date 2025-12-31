import { useQuery } from '@tanstack/react-query';
import { useSquareAuthStatus } from './useSquareAuth';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface SquareOverview {
  totalRevenue: number;
  totalQuantity: number;
  totalOrders: number;
  totalPayments: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

interface SquareTopItem {
  itemName: string;
  revenue: number;
  quantity: number;
  orders: number;
  percentage: number;
}

interface SquareTopCategory {
  category: string;
  revenue: number;
  quantity: number;
  orders: number;
  percentage: number;
}

interface SquareRealtimeMetrics {
  averageOrderValue: number;
  itemsPerOrder: number;
  paymentSuccessRate: number;
}

interface SquareDashboardData {
  overview: SquareOverview;
  topItems: SquareTopItem[];
  topCategories: SquareTopCategory[];
  realtimeMetrics: SquareRealtimeMetrics;
  timeSeries: Array<{
    date: string;
    revenue: number;
    quantity: number;
    orders: number;
  }>;
  lastSync: string;
}

const formatDateForAPI = (date: Date | null): string | undefined => {
  return date ? date.toISOString().split('T')[0] : undefined;
};

export function useSquareData(dateRange: DateRange) {
  const authStatus = useSquareAuthStatus();
  const startDate = formatDateForAPI(dateRange.startDate);
  const endDate = formatDateForAPI(dateRange.endDate);

  // Only fetch Square data if authenticated
  const isAuthenticated = authStatus.data?.isAuthenticated;

  // For initial load, get all historical data if no specific date range
  const shouldFetchAllData = !startDate || !endDate;

  const squareSalesSummary = useQuery({
    queryKey: ['square', 'sales-summary', startDate, endDate],
    queryFn: async (): Promise<SquareDashboardData> => {
      const params = new URLSearchParams();
      params.set('type', 'sales-summary');
      
      // For now, don't add any date filters to get ALL historical data
      // TODO: Add proper date filtering after we confirm we can get all data
      console.log('📅 Fetching ALL Square data (no date filters)');
      // params.set('startDate', startDate);
      // params.set('endDate', endDate);
      
      console.log('🔄 Fetching Square sales summary data...');
      const response = await fetch(`/api/square/realtime?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Square sales summary');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch Square sales summary');
      }
      
      const data = result.data;
      console.log('✅ Square sales summary fetched:', data.overview);
      
      // Generate time series data from the orders
      const timeSeries = generateTimeSeriesFromOrders(data, dateRange);
      
      return {
        ...data,
        timeSeries
      };
    },
    enabled: isAuthenticated === true,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    retry: 2,
  });

  const squareOrders = useQuery({
    queryKey: ['square', 'orders', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'orders');
      
      // For now, don't add any date filters to get ALL historical data
      console.log('📅 Fetching ALL Square orders (no date filters)');
      // params.set('startDate', startDate);
      // params.set('endDate', endDate);
      
      console.log('🔄 Fetching Square orders for time series...');
      const response = await fetch(`/api/square/realtime?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Square orders');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch Square orders');
      }
      
      return result.data;
    },
    enabled: isAuthenticated === true,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
  });

  // Transform Square data to match dashboard format
  const transformedData = squareSalesSummary.data ? {
    overview: {
      totalRevenue: squareSalesSummary.data.overview.totalRevenue,
      totalQuantity: squareSalesSummary.data.overview.totalQuantity,
      reportCount: squareSalesSummary.data.overview.totalOrders,
      itemCount: squareSalesSummary.data.topItems.length,
      dateRange: squareSalesSummary.data.overview.dateRange,
      previousPeriod: undefined, // Could be enhanced later
    },
    topCategories: squareSalesSummary.data.topCategories.map(cat => ({
      category: cat.category,
      revenue: cat.revenue,
      quantity: cat.quantity,
      percentage: cat.percentage,
    })),
    topItems: squareSalesSummary.data.topItems.map(item => ({
      itemName: item.itemName,
      revenue: item.revenue,
      quantity: item.quantity,
      percentage: item.percentage,
    })),
    timeSeries: squareSalesSummary.data.timeSeries,
    realtimeMetrics: squareSalesSummary.data.realtimeMetrics,
    lastSync: squareSalesSummary.data.lastSync,
  } : undefined;

  const isLoading = squareSalesSummary.isLoading || squareOrders.isLoading;
  const error = squareSalesSummary.error || squareOrders.error;

  return {
    data: transformedData,
    isLoading,
    error,
    isAuthenticated,
    refetch: () => {
      squareSalesSummary.refetch();
      squareOrders.refetch();
    },
  };
}

// Helper function to generate time series data from orders
function generateTimeSeriesFromOrders(squareData: any, dateRange: DateRange): Array<{
  date: string;
  revenue: number;
  quantity: number;
  orders: number;
}> {
  if (!squareData?.orders) return [];

  // Group orders by date
  const dailyData = new Map<string, { revenue: number; quantity: number; orders: number }>();
  
  // Initialize with zero values for each date in range
  if (dateRange.startDate && dateRange.endDate) {
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyData.set(dateStr, { revenue: 0, quantity: 0, orders: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // If we have orders from the API response, aggregate them
  if (squareData.orders) {
    squareData.orders.forEach((order: any) => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      const existing = dailyData.get(orderDate) || { revenue: 0, quantity: 0, orders: 0 };
      
      const orderQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      
      dailyData.set(orderDate, {
        revenue: existing.revenue + order.totalAmount,
        quantity: existing.quantity + orderQuantity,
        orders: existing.orders + 1,
      });
    });
  }

  // Convert to array and sort by date
  return Array.from(dailyData.entries())
    .map(([date, data]) => ({
      date,
      ...data,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function useSquareStats() {
  const authStatus = useSquareAuthStatus();
  const isAuthenticated = authStatus.data?.isAuthenticated;

  return useQuery({
    queryKey: ['square', 'dashboard-stats'],
    queryFn: async () => {
      console.log('🔄 Fetching Square dashboard stats...');
      
      // Get current week and previous week data
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(currentWeekStart.getDate() - 7);
      
      const previousWeekEnd = new Date(currentWeekStart);
      previousWeekEnd.setDate(currentWeekStart.getDate() - 1);

      // Get catalog items count
      const catalogResponse = await fetch('/api/square/realtime?type=catalog');
      const catalogResult = await catalogResponse.json();
      const totalItems = catalogResult.success ? catalogResult.data.totalItems : 0;

      // Get current week sales
      const currentWeekResponse = await fetch(
        `/api/square/realtime?type=sales-summary&startDate=${formatDateForAPI(currentWeekStart)}&endDate=${formatDateForAPI(now)}`
      );
      const currentWeekResult = await currentWeekResponse.json();
      const currentWeekRevenue = currentWeekResult.success ? currentWeekResult.data.overview.totalRevenue : 0;

      // Get previous week sales
      const previousWeekResponse = await fetch(
        `/api/square/realtime?type=sales-summary&startDate=${formatDateForAPI(previousWeekStart)}&endDate=${formatDateForAPI(previousWeekEnd)}`
      );
      const previousWeekResult = await previousWeekResponse.json();
      const previousWeekRevenue = previousWeekResult.success ? previousWeekResult.data.overview.totalRevenue : 0;

      // Get last 12 weeks for average
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - (12 * 7));
      
      const twelveWeeksResponse = await fetch(
        `/api/square/realtime?type=sales-summary&startDate=${formatDateForAPI(twelveWeeksAgo)}`
      );
      const twelveWeeksResult = await twelveWeeksResponse.json();
      const twelveWeeksRevenue = twelveWeeksResult.success ? twelveWeeksResult.data.overview.totalRevenue : 0;

      // Get last 6 months for average
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const sixMonthsResponse = await fetch(
        `/api/square/realtime?type=sales-summary&startDate=${formatDateForAPI(sixMonthsAgo)}`
      );
      const sixMonthsResult = await sixMonthsResponse.json();
      const sixMonthsRevenue = sixMonthsResult.success ? sixMonthsResult.data.overview.totalRevenue : 0;

      // Calculate stats
      const averageWeeklyRevenue = twelveWeeksRevenue / 12;
      const averageMonthlyRevenue = sixMonthsRevenue / 6;
      const lastWeekChange = previousWeekRevenue > 0 ? 
        ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100 : 0;

      console.log('✅ Square dashboard stats calculated');

      return {
        totalItems,
        recentInvoices: 0, // Square doesn't have invoices concept
        pendingReviews: 0,
        averageWeeklyRevenue,
        averageMonthlyRevenue,
        lastWeekRevenue: currentWeekRevenue,
        lastWeekChange,
      };
    },
    enabled: isAuthenticated === true,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
    retry: 2,
  });
}