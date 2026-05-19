'use client';

import { useEffect, useRef, useState } from 'react';
import { AccountSwitchButton } from '@/app/account-switch-button';
import { PageTransition, Sidebar } from '@superplus/ui';

const adminNav = [
  { section: 'Operations', label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { section: 'Operations', label: 'Activity', icon: 'timeline', href: '/admin/activity' },
  { section: 'Operations', label: 'Logbook', icon: 'history', href: '/admin/logbook' },
  { section: 'Operations', label: 'Reports', icon: 'analytics', href: '/admin/reports' },
  { section: 'Store Ops', label: 'People', icon: 'group', href: '/admin/people' },
  { section: 'Store Ops', label: 'Tasks', icon: 'assignment', href: '/admin/tasks' },
  { section: 'Store Ops', label: 'Checklists', icon: 'checklist', href: '/admin/checklists' },
  { section: 'Store Ops', label: 'Schedules', icon: 'calendar_month', href: '/admin/schedules' },
  { section: 'Supply', label: 'Supply Ops', icon: 'hub', href: '/admin/supply' },
  { section: 'Supply', label: 'Products', icon: 'inventory_2', href: '/admin/products' },
  { section: 'Supply', label: 'Categories', icon: 'category', href: '/admin/categories' },
  { section: 'Supply', label: 'Suppliers', icon: 'local_shipping', href: '/admin/suppliers' },
  { section: 'Supply', label: 'Orders', icon: 'receipt_long', href: '/admin/orders' },
  { section: 'Knowledge', label: 'Promotions', icon: 'sell', href: '/admin/promotions' },
  { section: 'Knowledge', label: 'Training', icon: 'school', href: '/admin/training' },
  { section: 'Knowledge', label: 'Suggestions', icon: 'lightbulb', href: '/admin/suggestions' },
  { section: 'System', label: 'Stores', icon: 'store', href: '/admin/stores' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('admin-sidebar-collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('[data-sidebar-close]')?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onPointerDown={() => setSidebarOpen(false)}
          onTouchStart={() => setSidebarOpen(false)}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar — hidden on mobile, fixed on desktop */}
      <div ref={sidebarRef} className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none lg:pointer-events-auto'
      }`}>
        <Sidebar
          items={adminNav}
          title="SuperPlus"
          onNavigate={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          footerSlot={(
            <AccountSwitchButton
              variant="navy"
              compact={sidebarCollapsed}
              className={sidebarCollapsed ? 'w-full px-0' : 'w-full justify-start px-4 text-sm'}
            />
          )}
        />
      </div>

      {/* Main content */}
      <main className={`flex-1 min-h-dvh bg-surface p-4 transition-[margin] duration-200 lg:p-8 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="sticky top-0 z-30 -mx-8 mb-4 hidden items-center justify-between gap-2 border-b border-border bg-surface/95 px-8 py-3 backdrop-blur lg:flex">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="flex min-h-12 items-center gap-2 rounded-[--radius-lg] bg-surface-cream px-4 text-sm font-extrabold text-on-surface-secondary active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">{sidebarCollapsed ? 'menu_open' : 'keyboard_double_arrow_left'}</span>
            {sidebarCollapsed ? 'Show Menu' : 'Hide Menu'}
          </button>
        </div>
        {/* Mobile admin bar */}
        <div className="sticky top-0 z-30 -mx-4 mb-6 flex items-center gap-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          {!sidebarOpen && (
            <button
              type="button"
              aria-expanded={sidebarOpen}
              aria-label="Open admin menu"
              onClick={() => {
                setSidebarCollapsed(false);
                setSidebarOpen(true);
              }}
              className="flex min-h-12 items-center gap-2 rounded-[--radius-lg] bg-brand px-4 text-sm font-extrabold text-on-brand shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
              Menu
            </button>
          )}
          <h1 className="text-lg font-bold text-brand flex-1">SuperPlus Admin</h1>
          <AccountSwitchButton variant="light" />
          <a href="/hub" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream">
            <span className="material-symbols-outlined text-on-surface-secondary">home</span>
          </a>
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
