'use client';

import { useState, useCallback } from 'react';
import { StatusBadge, LoadingState, EmptyState, NotificationBanner } from '@superplus/ui';
import { useActiveMarkdowns } from '@superplus/db/hooks';
import { useRealtimeMarkdowns } from '@superplus/db/realtime';
import { useSupabase } from '@superplus/auth';
import { endMarkdown } from '@superplus/db/queries/markdowns';
import type { Markdown, Product } from '@superplus/db';

interface ActiveMarkdownsProps {
  userId: string;
}

type MarkdownWithProduct = Markdown & { product: Product };

const REASON_LABELS: Record<string, string> = {
  approaching_expiry: 'Approaching Expiry',
  damaged: 'Damaged',
  overstock: 'Overstock',
  promo: 'Promo',
  manager_directed: 'Manager Directed',
  other: 'Other',
};

export function ActiveMarkdowns({ userId }: ActiveMarkdownsProps) {
  const supabase = useSupabase();
  const { data: markdowns, loading, refetch } = useActiveMarkdowns();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useRealtimeMarkdowns(() => {
    refetch();
  });

  const handleEndMarkdown = useCallback(
    async (markdownId: string) => {
      setEndingId(markdownId);
      try {
        await endMarkdown(supabase, markdownId);
        setSuccessMsg('Markdown ended successfully');
        refetch();
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err) {
        console.error('Failed to end markdown:', err);
      } finally {
        setEndingId(null);
      }
    },
    [refetch]
  );

  if (loading) {
    return <LoadingState message="Loading active markdowns..." />;
  }

  const typedMarkdowns = (markdowns ?? []) as MarkdownWithProduct[];

  if (typedMarkdowns.length === 0) {
    return (
      <EmptyState
        title="No Active Markdowns"
        description="Create a new markdown to see it here"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        {typedMarkdowns.length} active markdown{typedMarkdowns.length !== 1 ? 's' : ''}
      </p>

      {typedMarkdowns.map((md) => {
        const timeRemaining = md.effective_until
          ? getTimeRemaining(md.effective_until)
          : 'Until removed';
        const approvalStatus = md.approved_by_user_id
          ? 'approved'
          : md.markdown_price < md.original_price * 0.5
          ? 'pending'
          : 'auto';

        return (
          <div key={md.id} className="bg-surface border border-gray-200 rounded-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-text-primary">
                  {md.product?.name ?? 'Unknown Product'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-text-secondary line-through">
                    ${md.original_price.toFixed(2)}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                  <span className="text-lg font-heading font-bold text-danger">
                    ${md.markdown_price.toFixed(2)}
                  </span>
                </div>
              </div>

              <StatusBadge
                label={approvalStatus === 'pending' ? 'Pending Approval' : 'Active'}
                variant={approvalStatus === 'pending' ? 'warning' : 'success'}
                size="sm"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                {REASON_LABELS[md.reason] ?? md.reason}
              </span>
              <span>{timeRemaining}</span>
            </div>

            <button
              onClick={() => handleEndMarkdown(md.id)}
              disabled={endingId === md.id}
              className="w-full py-2.5 px-4 bg-gray-100 text-text-primary text-sm font-medium rounded-button hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {endingId === md.id ? 'Ending...' : 'End Markdown'}
            </button>
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

function getTimeRemaining(effectiveUntil: string): string {
  const now = new Date();
  const end = new Date(effectiveUntil);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  if (hours > 0) return `${hours}h remaining`;

  const minutes = Math.floor(diffMs / (1000 * 60));
  return `${minutes}m remaining`;
}
