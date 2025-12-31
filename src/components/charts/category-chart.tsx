'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

interface CategoryData {
  category: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

interface CategoryChartProps {
  data: CategoryData[];
  type?: 'bar' | 'pie';
  height?: number;
  showQuantity?: boolean;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280',
];

export function CategoryChart({ 
  data, 
  type = 'bar', 
  height = 300, 
  showQuantity = true 
}: CategoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No category data available</p>
        </div>
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ category, percentage }) => 
              percentage > 5 ? `${category} (${percentage.toFixed(1)}%)` : ''
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="revenue"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            labelFormatter={(label) => `Category: ${label}`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart 
        data={data} 
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="category" 
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fontSize: 12 }}
          interval={0}
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
            
            const data = payload[0].payload as CategoryData;
            
            return (
              <div className="bg-white p-3 border rounded-lg shadow-lg">
                <p className="font-medium mb-2">{label}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-medium">{formatCurrency(data.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-medium">{data.quantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Percentage:</span>
                    <span className="font-medium">{data.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Legend />
        
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          fill="#3B82F6"
          name="Revenue"
          radius={[2, 2, 0, 0]}
        />
        
        {showQuantity && (
          <Bar
            yAxisId="quantity"
            dataKey="quantity"
            fill="#10B981"
            name="Quantity"
            radius={[2, 2, 0, 0]}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}