'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface NavItem {
  label: string;
  icon: string;
  href: string;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface-white z-50 flex justify-around items-center px-2 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/hub' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`flex min-h-12 w-[72px] flex-col items-center justify-center rounded-2xl py-1.5 transition-colors duration-150 active:scale-[0.98] ${
              active
                ? 'bg-brand text-on-brand shadow-sm'
                : 'text-on-surface-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
            <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
