'use client';

import { useState } from 'react';
import { StatusBadge, getStatusVariant, LoadingState, EmptyState } from '@superplus/ui';
import { useChecklistHistory } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import type { Checklist, ChecklistItem } from '@superplus/db';

export function ChecklistHistory() {
  const supabase = useSupabase();
  const { data: checklists, loading } = useChecklistHistory(50);
  const [selectedChecklist, setSelectedChecklist] = useState<(Checklist & { items: ChecklistItem[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleSelectChecklist(checklist: Checklist) {
    setDetailLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklist.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setSelectedChecklist({ ...checklist, items: items ?? [] });
    } catch (err) {
      console.error('Failed to load checklist details:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading history..." />;
  }

  if (!checklists || checklists.length === 0) {
    return (
      <EmptyState
        title="No Checklists Yet"
        description="Completed checklists will appear here"
      />
    );
  }

  // Detail view
  if (selectedChecklist) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedChecklist(null)}
          className="flex items-center gap-1 text-sm text-brand-primary font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to list
        </button>

        <div className="bg-surface border border-gray-200 rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-text-primary capitalize">
              {selectedChecklist.checklist_type} Checklist
            </h3>
            <StatusBadge
              label={selectedChecklist.status}
              variant={getStatusVariant(selectedChecklist.status)}
              size="sm"
            />
          </div>
          <p className="text-sm text-text-secondary">
            {new Date(selectedChecklist.shift_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {selectedChecklist.completed_at && (
            <p className="text-xs text-text-secondary mt-1">
              Completed at {new Date(selectedChecklist.completed_at).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {selectedChecklist.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-card border ${
                item.is_completed ? 'bg-success/5 border-success/20' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.is_completed ? 'bg-success' : 'bg-gray-300'
                }`}
              >
                {item.is_completed ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.is_completed ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {item.task_text.replace(/\[(checkbox|numeric|cash|photo)\]/i, '').trim()}
                </p>
                {item.value_entered && (
                  <p className="text-xs text-text-secondary mt-0.5">Value: {item.value_entered}</p>
                )}
              </div>
              {item.is_critical && (
                <StatusBadge label="Critical" variant="danger" size="sm" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-3">
      {checklists.map((checklist) => {
        const duration =
          checklist.completed_at && checklist.started_at
            ? getTimeDiff(checklist.started_at, checklist.completed_at)
            : null;

        return (
          <button
            key={checklist.id}
            onClick={() => handleSelectChecklist(checklist)}
            className="w-full text-left bg-surface border border-gray-200 rounded-card p-4 hover:shadow-md active:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-text-primary capitalize">
                  {checklist.checklist_type} Checklist
                </h3>
                <p className="text-sm text-text-secondary mt-0.5">
                  {new Date(checklist.shift_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge
                  label={checklist.status}
                  variant={getStatusVariant(checklist.status)}
                  size="sm"
                />
                {duration && (
                  <p className="text-xs text-text-secondary mt-1">{duration}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getTimeDiff(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}
