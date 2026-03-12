'use client';

import { useState } from 'react';
import { AppShell, LoadingState } from '@superplus/ui';
import { useAuth } from '@superplus/auth';
import { IssueForm } from './components/issue-form';
import { IssueList } from './components/issue-list';

type ViewTab = 'report' | 'open' | 'history';

export default function IssueLoggerPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewTab>('report');

  if (authLoading) {
    return (
      <AppShell title="Issue Logger">
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Issue Logger">
      {/* Tab navigation */}
      <div className="flex bg-gray-100 rounded-button p-1 mb-4">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'report'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          Report
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'open'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          Open Issues
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'history'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'report' && (
        <IssueForm
          userId={user?.id ?? ''}
          onCreated={() => setActiveTab('open')}
        />
      )}

      {activeTab === 'open' && (
        <IssueList
          statusFilter={['open', 'in_progress']}
          userId={user?.id ?? ''}
          userRole={role}
        />
      )}

      {activeTab === 'history' && (
        <IssueList
          statusFilter={['resolved']}
          userId={user?.id ?? ''}
          userRole={role}
        />
      )}
    </AppShell>
  );
}
