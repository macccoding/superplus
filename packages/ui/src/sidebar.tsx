'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface SidebarItem {
  label: string;
  icon: string;
  href: string;
}

export function Sidebar({ items, title, onNavigate }: { items: SidebarItem[]; title: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-dvh bg-navy text-on-navy fixed left-0 top-0 flex flex-col">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.png" alt="SuperPlus" className="h-8 brightness-0 invert" />
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="text-[11px] text-white/50">Admin</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-[--radius-md] text-sm font-medium transition-all duration-200 ${
                active ? 'bg-brand text-white shadow-sm' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link href="/hub" onClick={() => onNavigate?.()} className="flex items-center gap-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-[--radius-md] transition-all">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Hub
        </Link>
      </div>
    </aside>
  );
}
