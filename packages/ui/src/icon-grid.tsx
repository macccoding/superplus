'use client';

import { useRouter } from 'next/navigation';

export interface IconGridItem {
  label: string;
  icon: string; // Material Symbols icon name
  href: string;
  color: string; // bg color class or hex
  badge?: number;
}

export function IconGrid({ items }: { items: IconGridItem[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-[--spacing-gutter] p-[--spacing-container]">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className="relative flex flex-col items-center justify-center gap-4 p-6 bg-surface-container-lowest rounded-xl shadow-sm active:scale-95 transition-all duration-200 min-h-[160px]"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: item.color }}
          >
            <span className="material-symbols-outlined text-[32px]">{item.icon}</span>
          </div>
          <span className="text-lg font-bold text-on-surface">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span className="absolute top-3 right-3 min-w-6 h-6 bg-primary text-on-primary text-xs font-bold rounded-full flex items-center justify-center px-1">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
