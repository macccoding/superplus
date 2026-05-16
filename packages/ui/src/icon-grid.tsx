'use client';

import { useRouter } from 'next/navigation';

export interface IconGridItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: number;
}

export function IconGrid({ items }: { items: IconGridItem[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className="relative flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-[12px] shadow-sm active:scale-95 transition-transform min-h-[120px]"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl"
            style={{ backgroundColor: item.color }}
          >
            {item.icon}
          </div>
          <span className="text-sm font-medium text-[#1A1A2E] text-center">
            {item.label}
          </span>
          {item.badge && item.badge > 0 ? (
            <span className="absolute top-2 right-2 w-6 h-6 bg-[#E31837] text-white text-xs font-bold rounded-full flex items-center justify-center">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
