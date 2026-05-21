'use client';

import { signOut } from 'next-auth/react';

interface AccountSwitchButtonProps {
  variant?: 'brand' | 'navy' | 'light';
  className?: string;
  compact?: boolean;
}

const variantClasses = {
  brand: 'bg-on-brand/15 text-on-brand active:bg-on-brand/25',
  navy: 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
  light: 'bg-surface-cream text-on-surface-secondary active:bg-surface',
};

export function AccountSwitchButton({ variant = 'brand', className = '', compact = false }: AccountSwitchButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/auth/login' })}
      aria-label="Switch user"
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-[--radius-md] px-3 text-xs font-extrabold transition-all active:scale-[0.98] ${variantClasses[variant]} ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
      <span className={compact ? 'sr-only' : undefined}>Switch</span>
    </button>
  );
}
