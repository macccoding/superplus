'use client';

import type { ReactNode } from 'react';

type StatVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down';
    value: string;
  };
  variant?: StatVariant;
  onClick?: () => void;
  className?: string;
}

const borderColorMap: Record<StatVariant, string> = {
  primary: 'border-t-brand-primary',
  success: 'border-t-success',
  warning: 'border-t-warning',
  danger: 'border-t-danger',
  info: 'border-t-brand-secondary',
};

const iconBgMap: Record<StatVariant, string> = {
  primary: 'bg-brand-primary/10 text-brand-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-brand-secondary/10 text-brand-secondary',
};

export function StatCard({
  icon,
  label,
  value,
  trend,
  variant = 'primary',
  onClick,
  className = '',
}: StatCardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-surface rounded-card border border-gray-100 border-t-4 ${borderColorMap[variant]} p-5 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow text-left w-full' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-secondary font-medium">{label}</p>
          <p className="text-3xl font-heading font-bold text-text-primary mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.direction === 'up' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-danger"
                >
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                  <polyline points="17 18 23 18 23 12" />
                </svg>
              )}
              <span
                className={`text-xs font-medium ${
                  trend.direction === 'up' ? 'text-success' : 'text-danger'
                }`}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBgMap[variant]}`}>
          {icon}
        </div>
      </div>
    </Component>
  );
}
