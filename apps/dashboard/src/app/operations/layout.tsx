'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardShell } from '../components/dashboard-shell';

const tabs = [
  { label: 'Checklists', href: '/operations/checklists' },
  { label: 'Tasks', href: '/operations/tasks' },
  { label: 'Issues', href: '/operations/issues' },
];

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Operations</h1>
        <p className="text-sm text-text-secondary mt-1">
          Checklists, tasks, and issue tracking
        </p>
      </div>

      {/* Tabs sub-navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </DashboardShell>
  );
}
