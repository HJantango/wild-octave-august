'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

interface HourlyData {
  hour: number;
  hourLabel: string;
  days: {
    [key: string]: {
      avgRevenue: number;
      avgOrders?: number;
      [key: string]: any;
    };
  };
  overallAvg: number;
  overallOrders?: number;
}

interface HourlyDayChartProps {
  data: HourlyData[];
  height?: number;
  title?: string;
  valueKey?: string; // which key from days to use (default: avgRevenue)
  ordersKey?: string; // which key to use for orders (default: avgOrders)
  colorScheme?: 'default' | 'cafe';
  showTransactions?: boolean; // show transaction count lines
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Colors for each day - distinct and readable
const DAY_COLORS = {
  Mon: '#3B82F6', // blue
  Tue: '#F97316', // orange
  Wed: '#6B7280', // gray
  Thu: '#EAB308', // yellow
  Fri: '#06B6D4', // cyan
  Sat: '#22C55E', // green
  Sun: '#1D4ED8', // dark blue (thicker line for emphasis)
  Avg: '#991B1B', // dark red for average
};

const CAFE_COLORS = {
  Mon: '#3B82F6', // blue
  Tue: '#F97316', // orange
  Wed: '#6B7280', // gray
  Thu: '#EAB308', // yellow
  Fri: '#06B6D4', // cyan
  Sat: '#22C55E', // green
  Sun: '#1D4ED8', // dark blue
  Avg: '#7C2D12', // dark brown for cafe average
};

export function HourlyDayChart({ 
  data, 
  height = 400, 
  title,
  valueKey = 'avgRevenue',
  ordersKey = 'avgOrders',
  colorScheme = 'default',
  showTransactions = false
}: HourlyDayChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No hourly data available</p>
        </div>
      </div>
    );
  }

  const colors = colorScheme === 'cafe' ? CAFE_COLORS : DAY_COLORS;

  // Transform data for recharts - one object per hour with all days as properties
  const chartData = data.map(hourRow => {
    const row: any = {
      hour: hourRow.hourLabel,
    };
    
    DAY_ORDER.forEach(day => {
      row[day] = hourRow.days[day]?.[valueKey] || 0;
      if (showTransactions) {
        row[`${day}_txn`] = hourRow.days[day]?.[ordersKey] || 0;
      }
    });
    
    row['Avg'] = hourRow.overallAvg || 0;
    if (showTransactions) {
      row['Avg_txn'] = hourRow.overallOrders || 0;
    }
    
    return row;
  });

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-center mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: showTransactions ? 60 : 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: '#9CA3AF' }}
          />
          <YAxis 
            yAxisId="revenue"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            tickLine={{ stroke: '#9CA3AF' }}
          />
          {showTransactions && (
            <YAxis 
              yAxisId="transactions"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value.toFixed(0)}`}
              tickLine={{ stroke: '#9CA3AF' }}
              label={{ value: 'Transactions', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 11, fill: '#6B7280' } }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              
              // Separate revenue and transaction items
              const revenueItems = payload.filter(p => !String(p.dataKey).endsWith('_txn'));
              const txnItems = payload.filter(p => String(p.dataKey).endsWith('_txn'));
              
              // Sort revenue by value descending
              const sortedRevenue = [...revenueItems].sort((a, b) => 
                (b.value as number) - (a.value as number)
              );
              
              return (
                <div className="bg-white p-3 border rounded-lg shadow-lg min-w-[180px]">
                  <p className="font-semibold mb-2 border-b pb-1">{label}</p>
                  {sortedRevenue.map((item, index) => {
                    const txnItem = txnItems.find(t => String(t.dataKey).replace('_txn', '') === item.dataKey);
                    return (
                      <div key={index} className="flex items-center justify-between text-sm py-0.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <div className="text-right ml-4">
                          <span className="font-medium">{formatCurrency(item.value as number)}</span>
                          {txnItem && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({(txnItem.value as number).toFixed(1)} txn)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Legend 
            verticalAlign="bottom"
            height={36}
            iconType="line"
          />
          
          {/* Day revenue lines */}
          {DAY_ORDER.map(day => (
            <Line
              key={day}
              yAxisId="revenue"
              type="monotone"
              dataKey={day}
              stroke={colors[day as keyof typeof colors]}
              strokeWidth={day === 'Sun' ? 3 : 2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
              name={day}
            />
          ))}
          
          {/* Average revenue line - dashed */}
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="Avg"
            stroke={colors.Avg}
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6, strokeWidth: 2 }}
            name="Average"
          />
          
          {/* Transaction lines - dotted, lighter weight */}
          {showTransactions && DAY_ORDER.map(day => (
            <Line
              key={`${day}_txn`}
              yAxisId="transactions"
              type="monotone"
              dataKey={`${day}_txn`}
              stroke={colors[day as keyof typeof colors]}
              strokeWidth={1}
              strokeDasharray="2 2"
              dot={false}
              activeDot={{ r: 3 }}
              legendType="none"
            />
          ))}
          
          {/* Average transaction line */}
          {showTransactions && (
            <Line
              yAxisId="transactions"
              type="monotone"
              dataKey="Avg_txn"
              stroke={colors.Avg}
              strokeWidth={2}
              strokeDasharray="2 4"
              dot={false}
              activeDot={{ r: 4 }}
              legendType="none"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
