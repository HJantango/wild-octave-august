'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Color palette
const COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981', 
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  pink: '#EC4899',
  gray: '#6B7280',
};

const PIE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

interface AnalyticsData {
  timeSeries: Array<{
    date: string;
    revenue: number;
    quantity: number;
    dayOfWeek?: string;
  }>;
  categories: Array<{
    category: string;
    revenue: number;
    quantity: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemName: string;
    revenue: number;
    quantity: number;
  }>;
  weeklyComparison?: Array<{
    week: string;
    revenue: number;
    quantity: number;
  }>;
  dayOfWeekStats?: Array<{
    day: string;
    avgRevenue: number;
    avgQuantity: number;
  }>;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  totals: {
    revenue: number;
    quantity: number;
    avgDaily: number;
    daysWithSales: number;
  };
}

interface AnalyticsChartsProps {
  data: AnalyticsData;
}

// Format date for display
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// Calculate day of week stats from time series
function calculateDayOfWeekStats(timeSeries: AnalyticsData['timeSeries']) {
  const dayStats: Record<string, { total: number; count: number; quantity: number }> = {
    'Sun': { total: 0, count: 0, quantity: 0 },
    'Mon': { total: 0, count: 0, quantity: 0 },
    'Tue': { total: 0, count: 0, quantity: 0 },
    'Wed': { total: 0, count: 0, quantity: 0 },
    'Thu': { total: 0, count: 0, quantity: 0 },
    'Fri': { total: 0, count: 0, quantity: 0 },
    'Sat': { total: 0, count: 0, quantity: 0 },
  };
  
  timeSeries.forEach(day => {
    const date = new Date(day.date);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    dayStats[dayName].total += day.revenue;
    dayStats[dayName].quantity += day.quantity;
    dayStats[dayName].count += 1;
  });
  
  return Object.entries(dayStats).map(([day, stats]) => ({
    day,
    avgRevenue: stats.count > 0 ? stats.total / stats.count : 0,
    avgQuantity: stats.count > 0 ? stats.quantity / stats.count : 0,
  }));
}

// Revenue Trend Chart - Clean area chart with gradient
function RevenueTrendChart({ data }: { data: AnalyticsData['timeSeries'] }) {
  const chartData = data.map(d => ({
    ...d,
    date: formatDateShort(d.date),
  }));
  
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>📈</span> Daily Revenue
        </CardTitle>
        <CardDescription>Sales trend over selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke={COLORS.primary}
                strokeWidth={2}
                fill="url(#revenueGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Day of Week Performance - Bar chart showing best days
function DayOfWeekChart({ data }: { data: AnalyticsData['timeSeries'] }) {
  const dayStats = calculateDayOfWeekStats(data);
  const maxRevenue = Math.max(...dayStats.map(d => d.avgRevenue));
  
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>📅</span> Best Days
        </CardTitle>
        <CardDescription>Average revenue by day of week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Avg Revenue']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar 
                dataKey="avgRevenue" 
                radius={[4, 4, 0, 0]}
              >
                {dayStats.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.avgRevenue === maxRevenue ? COLORS.secondary : COLORS.primary}
                    opacity={entry.avgRevenue === maxRevenue ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Category Breakdown - Donut chart
function CategoryChart({ data }: { data: AnalyticsData['categories'] }) {
  const total = data.reduce((sum, c) => sum + c.revenue, 0);
  
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>🥧</span> Category Sales
        </CardTitle>
        <CardDescription>Revenue by product category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 flex">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="revenue"
                  nameKey="category"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 flex flex-col justify-center space-y-2 pl-2">
            {data.slice(0, 6).map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-700 truncate max-w-[100px]">{cat.category || 'Other'}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {((cat.revenue / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Top Sellers - Horizontal bar chart
function TopSellersChart({ data }: { data: AnalyticsData['topItems'] }) {
  const chartData = data.slice(0, 8).map(item => ({
    ...item,
    name: item.itemName.length > 20 ? item.itemName.substring(0, 20) + '...' : item.itemName,
  }));
  
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>🏆</span> Top Sellers
        </CardTitle>
        <CardDescription>Best performing products by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis 
                type="number"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <YAxis 
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'revenue' ? formatCurrency(value) : value,
                  name === 'revenue' ? 'Revenue' : 'Qty'
                ]}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill={COLORS.secondary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Analytics Charts Component
export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RevenueTrendChart data={data.timeSeries} />
      <DayOfWeekChart data={data.timeSeries} />
      <CategoryChart data={data.categories} />
      <TopSellersChart data={data.topItems} />
    </div>
  );
}

// Empty state
export function EmptyAnalyticsCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-0 shadow-lg">
          <CardContent className="p-6 h-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-500">No sales data yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Run a Square sync to load data
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
