'use client';

import { clsx } from 'clsx';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-12 px-4', className)}>
      <svg
        className="w-12 h-12 text-danger mb-3"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </svg>
      <h3 className="text-base font-heading font-semibold text-text-primary mb-1">
        {title}
      </h3>
      <p className="text-sm text-text-secondary text-center max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-button hover:bg-brand-primary/90 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
