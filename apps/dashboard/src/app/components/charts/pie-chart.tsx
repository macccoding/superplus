'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PieChartProps {
  data: Record<string, any>[];
  dataKey: string;
  nameKey: string;
  height?: number;
  className?: string;
  colors?: string[];
}

const BRAND_PALETTE = [
  '#E31837',
  '#1B3A5C',
  '#F5A623',
  '#2ECC71',
  '#9B59B6',
  '#3498DB',
  '#E74C3C',
  '#F39C12',
  '#1ABC9C',
  '#34495E',
];

export function PieChartWidget({
  data,
  dataKey,
  nameKey,
  height = 300,
  className = '',
  colors = BRAND_PALETTE,
}: PieChartProps) {
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
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            fill="#E31837"
            dataKey={dataKey}
            nameKey={nameKey}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: '12px' }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
