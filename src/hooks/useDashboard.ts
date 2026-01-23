import { useQuery } from '@tanstack/react-query';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DashboardOverview {
  totalRevenue: number;
  totalQuantity: number;
  reportCount: number;
  itemCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  previousPeriod?: {
    totalRevenue: number;
    totalQuantity: number;
    revenueChange: number;
    quantityChange: number;
  };
}

interface TopCategory {
  category: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

interface TopItem {
  itemName: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

interface TimeSeriesData {
  date: string;
  revenue: number;
  quantity: number;
  previousPeriodRevenue?: number;
  previousPeriodQuantity?: number;
  revenueChange?: number;
  quantityChange?: number;
}

interface DashboardData {
  overview: DashboardOverview;
  topCategories: TopCategory[];
  topItems: TopItem[];
  timeSeries: TimeSeriesData[];
}

interface DashboardStats {
  totalItems: number;
  recentInvoices: number;
  pendingReviews: number;
  averageWeeklyRevenue: number;
  averageMonthlyRevenue: number;
  lastWeekRevenue: number;
  lastWeekChange: number;
}

const formatDateForAPI = (date: Date | null): string | undefined => {
  return date ? date.toISOString().split('T')[0] : undefined;
};

const getPreviousPeriod = (dateRange: DateRange): DateRange => {
  if (!dateRange.startDate || !dateRange.endDate) {
    return { startDate: null, endDate: null };
  }

  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  
  // Calculate the number of days in the current period
  const periodLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Calculate previous period dates
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - periodLength + 1);

  return {
    startDate: previousStart,
    endDate: previousEnd
  };
};

const getLastWeekRange = (): DateRange => {
  const now = new Date();
  const lastWeekEnd = new Date(now);
  lastWeekEnd.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // Previous Sunday
  return { startDate: lastWeekStart, endDate: lastWeekEnd };
};

const getWeekBeforeLastRange = (): DateRange => {
  const lastWeek = getLastWeekRange();
  const weekBeforeEnd = new Date(lastWeek.startDate!);
  weekBeforeEnd.setDate(weekBeforeEnd.getDate() - 1);
  const weekBeforeStart = new Date(weekBeforeEnd);
  weekBeforeStart.setDate(weekBeforeEnd.getDate() - 6);
  return { startDate: weekBeforeStart, endDate: weekBeforeEnd };
};

export function useDashboardData(dateRange?: DateRange) {
  const startDate = formatDateForAPI(dateRange?.startDate || null);
  const endDate = formatDateForAPI(dateRange?.endDate || null);
  
  const previousPeriod = getPreviousPeriod(dateRange || { startDate: null, endDate: null });
  const previousStartDate = formatDateForAPI(previousPeriod.startDate);
  const previousEndDate = formatDateForAPI(previousPeriod.endDate);

  const salesSummary = useQuery({
    queryKey: ['sales-summary', startDate, endDate],
    queryFn: async (): Promise<{ overview: DashboardOverview; topCategories: TopCategory[]; topItems: TopItem[] }> => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const response = await fetch(`/api/sales/summary?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sales summary');
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch sales summary');
      }
      
      return result.data;
    },
    staleTime: 0, // Disable caching for debugging
    cacheTime: 0,
  });

  const previousSalesSummary = useQuery({
    queryKey: ['sales-summary-previous', previousStartDate, previousEndDate],
    queryFn: async (): Promise<{ overview: DashboardOverview; topCategories: TopCategory[]; topItems: TopItem[] }> => {
      if (!previousStartDate || !previousEndDate) {
        return {
          overview: {
            totalRevenue: 0,
            totalQuantity: 0,
            reportCount: 0,
            itemCount: 0,
            dateRange: { start: null, end: null }
          },
          topCategories: [],
          topItems: []
        };
      }

      const params = new URLSearchParams();
      params.set('startDate', previousStartDate);
      params.set('endDate', previousEndDate);
      
      const response = await fetch(`/api/sales/summary?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch previous period sales summary');
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch previous period sales summary');
      }
      
      return result.data;
    },
    staleTime: 0, // Disable caching for debugging
    cacheTime: 0,
    enabled: !!previousStartDate && !!previousEndDate,
  });

  const timeSeries = useQuery({
    queryKey: ['sales-timeseries', startDate, endDate],
    queryFn: async (): Promise<{ timeSeries: TimeSeriesData[]; categoryBreakdown: any[] }> => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const response = await fetch(`/api/sales/timeseries?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch time series data');
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch time series data');
      }
      
      return result.data;
    },
    staleTime: 0, // Disable caching for debugging
    cacheTime: 0,
  });

  const dashboardStats = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      try {
        // Calculate date ranges for averages
        const lastWeek = getLastWeekRange();
        const weekBeforeLast = getWeekBeforeLastRange();
        
        // Get last 12 weeks for weekly average (3 months)
        const twelveWeeksAgo = new Date();
        twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - (12 * 7));
        
        // Get last 6 months for monthly average  
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);


        // Fetch additional stats from various endpoints
        const [itemsResponse, invoicesResponse, weeklyAvgResponse, monthlyAvgResponse, lastWeekResponse, weekBeforeResponse] = await Promise.all([
          fetch('/api/items?limit=1'),
          fetch('/api/invoices?limit=1'),
          fetch(`/api/sales/summary?startDate=${formatDateForAPI(twelveWeeksAgo)}`),
          fetch(`/api/sales/summary?startDate=${formatDateForAPI(sixMonthsAgo)}`),
          fetch(`/api/sales/summary?startDate=${formatDateForAPI(lastWeek.startDate)}&endDate=${formatDateForAPI(lastWeek.endDate)}`),
          fetch(`/api/sales/summary?startDate=${formatDateForAPI(weekBeforeLast.startDate)}&endDate=${formatDateForAPI(weekBeforeLast.endDate)}`)
        ]);

        const [itemsResult, invoicesResult, weeklyAvgResult, monthlyAvgResult, lastWeekResult, weekBeforeResult] = await Promise.all([
          itemsResponse.json(),
          invoicesResponse.json(),
          weeklyAvgResponse.json(),
          monthlyAvgResponse.json(),
          lastWeekResponse.json(),
          weekBeforeResponse.json()
        ]);

        // Calculate averages with safety checks
        const twelveWeeksRevenue = weeklyAvgResult.success ? Number(weeklyAvgResult.data?.overview?.totalRevenue) || 0 : 0;
        const sixMonthsRevenue = monthlyAvgResult.success ? Number(monthlyAvgResult.data?.overview?.totalRevenue) || 0 : 0;
        const lastWeekRevenue = lastWeekResult.success ? Number(lastWeekResult.data?.overview?.totalRevenue) || 0 : 0;
        const weekBeforeRevenue = weekBeforeResult.success ? Number(weekBeforeResult.data?.overview?.totalRevenue) || 0 : 0;

        const averageWeeklyRevenue = isNaN(twelveWeeksRevenue) || twelveWeeksRevenue === 0 ? 0 : twelveWeeksRevenue / 12;
        const averageMonthlyRevenue = isNaN(sixMonthsRevenue) || sixMonthsRevenue === 0 ? 0 : sixMonthsRevenue / 6;

        // Calculate week-over-week change
        const lastWeekChange = weekBeforeRevenue > 0 ?
          ((lastWeekRevenue - weekBeforeRevenue) / weekBeforeRevenue) * 100 : 0;


        return {
          totalItems: itemsResult.success ? itemsResult.data?.pagination?.total || 0 : 0,
          recentInvoices: invoicesResult.success ? invoicesResult.data?.pagination?.total || 0 : 0,
          pendingReviews: 0,
          averageWeeklyRevenue,
          averageMonthlyRevenue,
          lastWeekRevenue,
          lastWeekChange,
        };
      } catch (error) {
        console.error('Dashboard stats error:', error);
        return {
          totalItems: 0,
          recentInvoices: 0,
          pendingReviews: 0,
          averageWeeklyRevenue: 0,
          averageMonthlyRevenue: 0,
          lastWeekRevenue: 0,
          lastWeekChange: 0,
        };
      }
    },
    staleTime: 0, // Disable caching for debugging
    cacheTime: 0,
  });

  const isLoading = salesSummary.isLoading || timeSeries.isLoading || dashboardStats.isLoading;
  const error = salesSummary.error || timeSeries.error || dashboardStats.error;



  // Create data object more leniently
  const data: DashboardData | undefined = salesSummary.data ? {
    overview: {
      ...salesSummary.data.overview,
      itemCount: dashboardStats.data?.totalItems || 0,
      previousPeriod: previousSalesSummary.data ? {
        totalRevenue: Number(previousSalesSummary.data.overview.totalRevenue) || 0,
        totalQuantity: Number(previousSalesSummary.data.overview.totalQuantity) || 0,
        revenueChange: (() => {
          const current = Number(salesSummary.data.overview.totalRevenue) || 0;
          const previous = Number(previousSalesSummary.data.overview.totalRevenue) || 0;
          if (current === 0 || previous === 0) return 0;
          const change = ((current - previous) / previous) * 100;
          return isNaN(change) ? 0 : change;
        })(),
        quantityChange: (() => {
          const current = Number(salesSummary.data.overview.totalQuantity) || 0;
          const previous = Number(previousSalesSummary.data.overview.totalQuantity) || 0;
          if (current === 0 || previous === 0) return 0;
          const change = ((current - previous) / previous) * 100;
          return isNaN(change) ? 0 : change;
        })(),
      } : undefined,
    },
    topCategories: salesSummary.data.topCategories || [],
    topItems: salesSummary.data.topItems || [],
    timeSeries: timeSeries.data?.timeSeries || [],
  } : undefined;



  const stats: DashboardStats | undefined = dashboardStats.data;

  return {
    data,
    stats,
    isLoading,
    error,
    refetch: () => {
      salesSummary.refetch();
      previousSalesSummary.refetch();
      timeSeries.refetch();
      dashboardStats.refetch();
    },
  };
}