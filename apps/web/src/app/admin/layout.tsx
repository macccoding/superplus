'use client';

import { useState } from 'react';
import { Sidebar } from '@superplus/ui';

const adminNav = [
  { label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { label: 'People', icon: 'group', href: '/admin/people' },
  { label: 'Products', icon: 'inventory_2', href: '/admin/products' },
  { label: 'Categories', icon: 'category', href: '/admin/categories' },
  { label: 'Checklists', icon: 'checklist', href: '/admin/checklists' },
  { label: 'Reports', icon: 'analytics', href: '/admin/reports' },
  { label: 'Schedules', icon: 'calendar_month', href: '/admin/schedules' },
  { label: 'Suppliers', icon: 'local_shipping', href: '/admin/suppliers' },
  { label: 'Orders', icon: 'receipt_long', href: '/admin/orders' },
  { label: 'Promotions', icon: 'sell', href: '/admin/promotions' },
  { label: 'Training', icon: 'school', href: '/admin/training' },
  { label: 'Suggestions', icon: 'lightbulb', href: '/admin/suggestions' },
  { label: 'Activity', icon: 'timeline', href: '/admin/activity' },
  { label: 'Stores', icon: 'store', href: '/admin/stores' },
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
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-lg font-bold text-primary flex-1">SuperPlus Admin</h1>
          <a href="/hub" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high">
            <span className="material-symbols-outlined text-on-surface-variant">home</span>
          </a>
        </div>
        {children}
      </main>
    </div>
  );
}
