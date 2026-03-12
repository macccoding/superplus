'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineConfig {
  dataKey: string;
  color: string;
  label: string;
}

interface LineChartProps {
  data: Record<string, any>[];
  lines: LineConfig[];
  xAxisKey: string;
  height?: number;
  className?: string;
}

const BRAND_COLORS = ['#E31837', '#1B3A5C', '#F5A623', '#2ECC71', '#9B59B6', '#3498DB'];

export function LineChartWidget({
  data,
  lines,
  xAxisKey,
  height = 300,
  className = '',
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-text-secondary ${className}`} style={{ height }}>
        No chart data available
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey={xAxisKey}
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
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '12px' }}
          />
          {lines.map((line, idx) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color || BRAND_COLORS[idx % BRAND_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
