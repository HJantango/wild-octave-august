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
import { formatCurrency, formatDate } from '@/lib/format';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    quantity: number;
  }>;
  height?: number;
  showQuantity?: boolean;
}

export function RevenueChart({ data, height = 300, showQuantity = true }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No sales data available</p>
        </div>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    date: formatDate(item.date),
    formattedRevenue: formatCurrency(item.revenue),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          yAxisId="revenue"
          orientation="left"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        {showQuantity && (
          <YAxis 
            yAxisId="quantity"
            orientation="right"
            tick={{ fontSize: 12 }}
          />
        )}
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;
            
            return (
              <div className="bg-white p-3 border rounded-lg shadow-lg">
                <p className="font-medium mb-2">{label}</p>
                {payload.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}:</span>
                    <span className="font-medium">
                      {item.dataKey === 'revenue' 
                        ? formatCurrency(item.value as number)
                        : item.value?.toLocaleString()
                      }
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend />
        
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
          name="Revenue"
        />
        
        {showQuantity && (
          <Line
            yAxisId="quantity"
            type="monotone"
            dataKey="quantity"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            name="Quantity"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}