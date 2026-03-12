'use client';

import { useState, useCallback } from 'react';
import { StatusBadge, LoadingState, EmptyState, NotificationBanner } from '@superplus/ui';
import { useStockEvents } from '@superplus/db/hooks';
import { useRealtimeStockEvents } from '@superplus/db/realtime';
import { useSupabase } from '@superplus/auth';
import { resolveStockEvent } from '@superplus/db/queries/stock-events';

interface PendingRestocksProps {
  userId: string;
}

export function PendingRestocks({ userId }: PendingRestocksProps) {
  const supabase = useSupabase();
  const {
    data: events,
    loading,
    refetch,
  } = useStockEvents({ eventType: 'restock_request' });
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Listen for realtime changes
  useRealtimeStockEvents(() => {
    refetch();
  });

  const pendingEvents = (events ?? []).filter((e) => !e.resolved_at);

  const handleResolve = useCallback(
    async (eventId: string) => {
      setResolvingId(eventId);
      try {
        await resolveStockEvent(supabase, eventId, userId);
        setSuccessMsg('Marked as restocked');
        refetch();
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err) {
        console.error('Failed to resolve:', err);
      } finally {
        setResolvingId(null);
      }
    },
    [userId, refetch]
  );

  if (loading) {
    return <LoadingState message="Loading pending restocks..." />;
  }

  if (pendingEvents.length === 0) {
    return (
      <EmptyState
        title="All Caught Up"
        description="No pending restock requests"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        {pendingEvents.length} pending restock{pendingEvents.length !== 1 ? 's' : ''}
      </p>

      {pendingEvents.map((event) => {
        const notes = event.notes ?? '';
        const priority = notes.includes('priority:urgent') ? 'urgent' : 'normal';
        const assignedMatch = notes.match(/assigned:(\S+)/);
        const timeReported = new Date(event.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={event.id}
            className={`bg-surface border rounded-card p-4 ${
              priority === 'urgent' ? 'border-danger/40 ring-1 ring-danger/10' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary">{event.product_id}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-text-secondary">{timeReported}</span>
                  <StatusBadge
                    label={priority === 'urgent' ? 'Urgent' : 'Normal'}
                    variant={priority === 'urgent' ? 'danger' : 'info'}
                    size="sm"
                  />
                  {assignedMatch && (
                    <span className="text-xs text-text-secondary">
                      Assigned
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleResolve(event.id)}
                disabled={resolvingId === event.id}
                className="flex-shrink-0 px-4 py-2 bg-success text-white text-sm font-medium rounded-button hover:bg-success/90 disabled:opacity-50 transition-colors"
              >
                {resolvingId === event.id ? 'Saving...' : 'Mark Restocked'}
              </button>
            </div>
          </div>
        );
      })}

      {successMsg && (
        <NotificationBanner
          type="success"
          message={successMsg}
          autoDismissMs={2000}
          onDismiss={() => setSuccessMsg(null)}
        />
      )}
    </div>
  );
}
