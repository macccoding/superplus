'use client';

import { useRouter } from 'next/navigation';

export interface IconGridItem {
  label: string;
  icon: string;
  href: string;
  color: string;
  badge?: number;
}

export function IconGrid({ items }: { items: IconGridItem[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-5">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          data-walkthrough={item.href.split('/').pop()}
          className="relative flex flex-col items-center justify-center gap-3 p-5 bg-surface-white rounded-[--radius-lg] shadow-[--shadow-card] active:scale-95 active:shadow-sm transition-all duration-200 min-h-[140px] border-2 border-transparent focus:border-brand"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: item.color }}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
          </div>
          <span className="text-[15px] font-bold text-on-surface">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span className="absolute top-2.5 right-2.5 min-w-5 h-5 bg-brand text-on-brand text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
