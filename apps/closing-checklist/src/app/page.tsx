'use client';

import { useState, useCallback } from 'react';
import { AppShell, QuickAction, LoadingState } from '@superplus/ui';
import { useAuth, useSupabase } from '@superplus/auth';
import { useActiveChecklist } from '@superplus/db/hooks';
import { createChecklist } from '@superplus/db/queries/checklists';
import type { Checklist, ChecklistItem } from '@superplus/db';
import { ChecklistStepper } from './components/checklist-stepper';
import { ChecklistHistory } from './components/checklist-history';

type ChecklistWithItems = Checklist & { items: ChecklistItem[] };

export default function ChecklistPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useSupabase();
  const { data: activeChecklist, loading: checklistLoading, refetch } = useActiveChecklist(user?.id ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [localChecklist, setLocalChecklist] = useState<ChecklistWithItems | null>(null);

  const currentChecklist = localChecklist ?? (activeChecklist as ChecklistWithItems | null);

  const handleStartChecklist = useCallback(async (type: 'opening' | 'closing') => {
    if (!user) return;
    setCreating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const checklist = await createChecklist(supabase, {
        type,
        shiftDate: today,
        userId: user.id,
      });
      setLocalChecklist(checklist);
    } catch (err) {
      console.error('Failed to create checklist:', err);
    } finally {
      setCreating(false);
    }
  }, [user]);

  const handleChecklistComplete = useCallback(() => {
    setLocalChecklist(null);
    refetch();
  }, [refetch]);

  if (authLoading || checklistLoading) {
    return (
      <AppShell title="Checklist">
        <LoadingState message="Loading checklist..." />
      </AppShell>
    );
  }

  if (showHistory) {
    return (
      <AppShell
        title="Checklist History"
        showBack
        onBack={() => setShowHistory(false)}
      >
        <ChecklistHistory />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Checklist"
      headerRight={
        <button
          onClick={() => setShowHistory(true)}
          className="text-sm text-white/90 hover:text-white font-medium px-3 py-1 rounded-button hover:bg-white/10 transition-colors"
        >
          History
        </button>
      }
    >
      {currentChecklist ? (
        <ChecklistStepper
          checklist={currentChecklist}
          onComplete={handleChecklistComplete}
        />
      ) : (
        <div className="space-y-4 mt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-primary">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h2 className="text-lg font-heading font-semibold text-text-primary">No Active Checklist</h2>
            <p className="text-sm text-text-secondary mt-1">Start an opening or closing checklist for today</p>
          </div>

          <QuickAction
            label="Start Opening Checklist"
            variant="primary"
            loading={creating}
            onClick={() => handleStartChecklist('opening')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />

          <QuickAction
            label="Start Closing Checklist"
            variant="secondary"
            loading={creating}
            onClick={() => handleStartChecklist('closing')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            }
          />
        </div>
      )}
    </AppShell>
  );
}
