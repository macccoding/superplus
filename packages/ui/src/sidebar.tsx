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
}

export function Sidebar({ items, title, onNavigate, footerSlot, collapsed = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Admin navigation"
      className={`${collapsed ? 'w-20' : 'w-[min(88vw,22rem)] lg:w-64'} pointer-events-auto relative z-10 flex h-dvh flex-col overflow-hidden overscroll-contain bg-navy text-on-navy touch-manipulation transition-[width] duration-200`}
    >
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
            data-sidebar-close
            onPointerDown={(event) => {
              event.preventDefault();
              onNavigate();
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              onNavigate();
            }}
            onClick={onNavigate}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[--radius-md] bg-white/10 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            Close Menu
          </button>
        )}
      </div>
      <nav aria-label="Admin sections" className={`${collapsed ? 'p-2' : 'p-3'} flex-1 space-y-0.5 overflow-y-auto overscroll-contain`}>
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
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 items-center rounded-[--radius-md] text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
                  active ? 'bg-white/10 text-white border-l-4 border-brand' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className={`${collapsed ? 'p-2' : 'p-3'} border-t border-white/10`}>
        {onNavigate && !collapsed && (
          <button
            type="button"
            data-sidebar-close
            onPointerDown={(event) => {
              event.preventDefault();
              onNavigate();
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              onNavigate();
            }}
            onClick={onNavigate}
            className="mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[--radius-md] bg-brand text-sm font-extrabold text-on-brand shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            Close Admin Menu
          </button>
        )}
        {footerSlot && <div className="mb-2">{footerSlot}</div>}
        <Link
          href="/hub"
          onClick={() => onNavigate?.()}
          title={collapsed ? 'Back to Hub' : undefined}
          aria-label="Back to Hub"
          className={`flex min-h-12 items-center text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-[--radius-md] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${collapsed ? 'justify-center px-0' : 'gap-2 px-4 py-2.5'}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
          {!collapsed && 'Back to Hub'}
        </Link>
      </div>
    </aside>
  );
}
