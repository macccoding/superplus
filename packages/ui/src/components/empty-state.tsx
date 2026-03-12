'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-12 px-4', className)}>
      {icon ? (
        <div className="text-text-secondary mb-3">{icon}</div>
      ) : (
        <svg
          className="w-12 h-12 text-gray-300 mb-3"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          <path d="M21 3v9h-9" />
        </svg>
      )}
      <h3 className="text-base font-heading font-semibold text-text-primary mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-text-secondary text-center max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
