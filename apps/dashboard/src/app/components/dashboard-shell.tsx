'use client';

import { useAuth } from '@superplus/auth';
import { LoadingState } from '@superplus/ui';
import { Sidebar } from './sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <main className="md:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
