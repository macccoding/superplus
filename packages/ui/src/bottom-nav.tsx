'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface NavItem {
  label: string;
  icon: string; // Material Symbols icon name
  href: string;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[--spacing-nav-height] bg-surface-container-lowest z-50 flex justify-around items-center px-2 shadow-[0_-1px_3px_0_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/hub' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-90 ${
              active
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className={`material-symbols-outlined ${active ? 'filled' : ''}`}>{item.icon}</span>
            <span className="text-xs font-medium mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
