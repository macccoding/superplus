'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface SidebarItem {
  label: string;
  icon: string; // Material Symbols icon name
  href: string;
}

export function Sidebar({ items, title, onNavigate }: { items: SidebarItem[]; title: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-dvh bg-secondary text-on-secondary fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined">hub</span>
          <h1 className="text-xl font-black">{title}</h1>
        </div>
        <p className="text-sm text-white/60 mt-1">Admin Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <Link href="/hub" onClick={() => onNavigate?.()} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Hub
        </Link>
      </div>
    </aside>
  );
}
