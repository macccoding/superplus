'use client';

import { clsx } from 'clsx';

type StatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'primary';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20',
  neutral: 'bg-gray-100 text-text-secondary border-gray-200',
  primary: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
};

const dotClasses: Record<StatusVariant, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-brand-secondary',
  neutral: 'bg-gray-400',
  primary: 'bg-brand-primary',
};

export function StatusBadge({
  label,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        variantClasses[variant],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full', dotClasses[variant])}
        />
      )}
      {label}
    </span>
  );
}

// Helper to map common statuses to variants
export function getStatusVariant(status: string): StatusVariant {
  switch (status) {
    case 'done':
    case 'completed':
    case 'resolved':
    case 'actioned':
    case 'in_stock':
      return 'success';
    case 'in_progress':
    case 'reviewed':
    case 'monitor':
      return 'warning';
    case 'open':
    case 'pending':
    case 'new':
      return 'info';
    case 'critical':
    case 'expired':
    case 'stockout':
    case 'dismissed':
      return 'danger';
    case 'incomplete':
      return 'warning';
    default:
      return 'neutral';
  }
}
