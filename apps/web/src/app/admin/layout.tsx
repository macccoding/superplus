'use client';

import { useState } from 'react';
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

  return (
    <div className="flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile, fixed on desktop */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar items={adminNav} title="SuperPlus" onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-dvh bg-surface p-4 lg:p-8 lg:ml-64">
        {/* Mobile header with hamburger */}
        <div className="flex items-center gap-3 mb-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-lg font-bold text-brand flex-1">SuperPlus Admin</h1>
          <a href="/hub" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-cream">
            <span className="material-symbols-outlined text-on-surface-secondary">home</span>
          </a>
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
