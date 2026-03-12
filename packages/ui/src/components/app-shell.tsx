'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  headerRight?: ReactNode;
  className?: string;
}

export function AppShell({
  children,
  title,
  subtitle,
  showBack,
  onBack,
  headerRight,
  className,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-brand-primary text-white shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center w-8 h-8 rounded-button hover:bg-white/20 transition-colors"
                aria-label="Go back"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-lg font-heading font-semibold leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-white/80 leading-tight">{subtitle}</p>
              )}
            </div>
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      </header>

      {/* Content */}
      <main className={clsx('px-4 py-4 pb-20', className)}>{children}</main>
    </div>
  );
}
