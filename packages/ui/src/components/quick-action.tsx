'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface QuickActionProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'warning' | 'secondary';
  size?: 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantClasses = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary/90 active:bg-brand-primary/80',
  danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
  success: 'bg-success text-white hover:bg-success/90 active:bg-success/80',
  warning: 'bg-warning text-white hover:bg-warning/90 active:bg-warning/80',
  secondary: 'bg-brand-secondary text-white hover:bg-brand-secondary/90 active:bg-brand-secondary/80',
};

export function QuickAction({
  label,
  icon,
  onClick,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  className,
}: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'w-full flex items-center justify-center gap-3 rounded-button font-heading font-semibold transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        size === 'lg' ? 'py-5 px-6 text-lg min-h-[64px]' : 'py-3 px-4 text-base min-h-[48px]',
        className
      )}
    >
      {loading ? (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
