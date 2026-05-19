'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface SidebarItem {
  label: string;
  icon: string;
  href: string;
  section?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  onNavigate?: () => void;
  footerSlot?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ items, title, onNavigate, footerSlot, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} h-dvh bg-navy text-on-navy fixed left-0 top-0 flex flex-col transition-[width] duration-200`}>
      <div className={`${collapsed ? 'p-3' : 'p-5'} border-b border-white/10`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <img src="/logo-white.png" alt="SuperPlus" className="h-8" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{title}</h1>
              <p className="text-[11px] text-white/50">Admin</p>
            </div>
          )}
        </div>
        {onNavigate && !collapsed && (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[--radius-md] bg-white/10 text-sm font-bold text-white lg:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
            Close Menu
          </button>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand admin menu' : 'Collapse admin menu'}
            className={`${collapsed ? 'mt-3 w-full' : 'mt-4 w-full'} hidden min-h-10 items-center justify-center gap-2 rounded-[--radius-md] bg-white/5 text-sm font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:flex`}
          >
            <span className="material-symbols-outlined text-[20px]">{collapsed ? 'menu_open' : 'keyboard_double_arrow_left'}</span>
            {!collapsed && <span>Hide Menu</span>}
          </button>
        )}
      </div>
      <nav className={`${collapsed ? 'p-2' : 'p-3'} flex-1 space-y-0.5 overflow-y-auto`}>
        {items.map((item, index) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          const showSection = !collapsed && item.section && item.section !== items[index - 1]?.section;
          return (
            <div key={item.href}>
              {showSection && (
                <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wide text-white/40 first:pt-1">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={() => onNavigate?.()}
                title={collapsed ? item.label : undefined}
                className={`flex min-h-11 items-center rounded-[--radius-md] text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                  active ? 'bg-white/10 text-white border-l-4 border-brand' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className={`${collapsed ? 'p-2' : 'p-3'} border-t border-white/10`}>
        {footerSlot && <div className="mb-2">{footerSlot}</div>}
        <Link
          href="/hub"
          onClick={() => onNavigate?.()}
          title={collapsed ? 'Back to Hub' : undefined}
          className={`flex min-h-11 items-center text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-[--radius-md] transition-all ${collapsed ? 'justify-center px-0' : 'gap-2 px-4 py-2.5'}`}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {!collapsed && 'Back to Hub'}
        </Link>
      </div>
    </aside>
  );
}
