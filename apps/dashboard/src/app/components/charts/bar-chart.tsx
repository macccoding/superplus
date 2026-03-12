'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: Record<string, any>[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  className?: string;
  layout?: 'vertical' | 'horizontal';
}

const BRAND_PRIMARY = '#E31837';

export function BarChartWidget({
  data,
  dataKey,
  labelKey,
  color = BRAND_PRIMARY,
  height = 300,
  className = '',
  layout = 'horizontal',
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-text-secondary ${className}`} style={{ height }}>
        No chart data available
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis
              type="category"
              dataKey={labelKey}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={24} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
