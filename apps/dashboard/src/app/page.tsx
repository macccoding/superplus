'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@superplus/auth';
import { useUnresolvedStockouts, useIssues, useShiftTasks, useChecklistHistory } from '@superplus/db/hooks';
import { DashboardShell } from './components/dashboard-shell';
import { StatCard } from './components/stat-card';
import { AlertFeed } from './components/alert-feed';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const quickLinks = [
  { label: 'Add Product', href: '/products', icon: '+ Product' },
  { label: 'View Inventory', href: '/inventory', icon: 'Inventory' },
  { label: 'Run Reports', href: '/reports', icon: 'Reports' },
  { label: 'Manage Staff', href: '/people', icon: 'People' },
];

export default function DashboardHome() {
  const { profile } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: stockouts } = useUnresolvedStockouts();
  const { data: openIssues } = useIssues({ status: 'open' });
  const { data: todayTasks } = useShiftTasks(today);
  const { data: checklists } = useChecklistHistory(10);

  const completedTasksToday = useMemo(
    () => todayTasks?.filter((t) => t.status === 'done').length ?? 0,
    [todayTasks]
  );

  const checklistsCompletedToday = useMemo(
    () =>
      checklists?.filter(
        (c) => c.shift_date === today && c.status === 'completed'
      ).length ?? 0,
    [checklists, today]
  );

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-text-primary">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'Manager'}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          variant="danger"
          label="Out of Stock"
          value={stockouts?.length ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.5 9.4l-9-5.19" />
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
          onClick={() => window.location.href = '/inventory'}
        />

        <StatCard
          variant="success"
          label="Tasks Done Today"
          value={completedTasksToday}
          trend={
            todayTasks && todayTasks.length > 0
              ? {
                  direction: completedTasksToday >= todayTasks.length * 0.8 ? 'up' : 'down',
                  value: `${todayTasks.length} total`,
                }
              : undefined
          }
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          onClick={() => window.location.href = '/operations/tasks'}
        />

        <StatCard
          variant="warning"
          label="Open Issues"
          value={openIssues?.length ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          onClick={() => window.location.href = '/operations/issues'}
        />

        <StatCard
          variant="info"
          label="Checklists Today"
          value={checklistsCompletedToday}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          }
          onClick={() => window.location.href = '/operations/checklists'}
        />
      </div>

      {/* Alert Feed */}
      <div className="mb-8">
        <AlertFeed />
      </div>

      {/* Quick Links */}
      <div className="bg-surface rounded-card border border-gray-100 p-6">
        <h3 className="text-base font-heading font-semibold text-text-primary mb-4">
          Quick Links
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-background rounded-button text-sm font-medium text-text-primary hover:bg-gray-100 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
