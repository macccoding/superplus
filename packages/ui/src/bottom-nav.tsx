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
    <nav className="fixed bottom-0 left-0 right-0 h-[--spacing-nav-height] bg-surface-container-lowest z-50 flex justify-around items-center px-2 shadow-lg border-t-2 border-surface-variant pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/hub' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[60px] rounded-xl active:scale-90 transition-all duration-150 ${
              active
                ? 'bg-primary text-on-primary px-4 py-1'
                : 'text-on-surface-variant hover:bg-surface-variant px-4 py-1'
            }`}
          >
            <span
              className={`material-symbols-outlined ${active ? 'filled' : ''}`}
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-xs font-medium mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
