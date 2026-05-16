'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface SidebarItem {
  label: string;
  icon: string;
  href: string;
}

export function Sidebar({ items, title }: { items: SidebarItem[]; title: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-dvh bg-[#1B3A5C] text-white fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-white/60 mt-1">Admin</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-medium transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <Link href="/hub" className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          ← Back to Hub
        </Link>
      </div>
    </aside>
  );
}
