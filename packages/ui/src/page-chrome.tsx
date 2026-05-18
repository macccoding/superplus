'use client';

import Link from 'next/link';

interface BackButtonProps {
  href: string;
  label?: string;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

type PageSkeletonVariant = 'task-list' | 'task-detail' | 'admin-tasks';

export function BackButton({ href, label = 'Back', className = '' }: BackButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2 rounded-[--radius-lg] bg-surface-white px-3 text-sm font-bold text-on-surface-secondary shadow-sm active:scale-[0.98] ${className}`}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      <span>{label}</span>
    </Link>
  );
}

export function PageHeader({ title, subtitle, backHref, backLabel, action, className = '' }: PageHeaderProps) {
  return (
    <header className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        {backHref && <BackButton href={backHref} label={backLabel} className="mb-3" />}
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-on-surface-secondary">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return <div className={`page-transition ${className}`}>{children}</div>;
}

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  if (variant === 'task-detail') {
    return (
      <div className="px-5 py-6 pb-28">
        <div className="mb-4 h-11 w-32 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
        <div className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
          <div className="mb-4 h-12 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
          <div className="mb-3 flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded-full bg-surface-cream" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-surface-cream" />
          </div>
          <div className="mb-3 h-7 w-4/5 animate-pulse rounded bg-surface-cream" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-cream" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="h-20 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
            <div className="h-20 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
          </div>
        </div>
        <div className="mt-4 h-36 animate-pulse rounded-[--radius-lg] bg-surface-white shadow-sm" />
      </div>
    );
  }

  if (variant === 'admin-tasks') {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-[--radius-lg] bg-surface-white" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-[--radius-lg] bg-surface-white" />
          <div className="h-24 animate-pulse rounded-[--radius-lg] bg-surface-white" />
          <div className="h-24 animate-pulse rounded-[--radius-lg] bg-surface-white" />
        </div>
        <div className="h-40 animate-pulse rounded-[--radius-lg] bg-surface-white" />
        <div className="space-y-2 rounded-[--radius-lg] bg-surface-white p-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-[--radius-lg] bg-surface-cream" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[--radius-lg] border-l-4 border-outline bg-surface-white p-4 shadow-sm">
          <div className="mb-3 flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-cream" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-surface-cream" />
          </div>
          <div className="mb-2 h-5 w-4/5 animate-pulse rounded bg-surface-cream" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-cream" />
        </div>
      ))}
    </div>
  );
}
