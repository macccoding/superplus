'use client';

import { useState, useCallback, useEffect } from 'react';
import { StatusBadge, LoadingState, EmptyState, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { getPendingApprovals, approveMarkdown, endMarkdown } from '@superplus/db/queries/markdowns';
import type { Markdown } from '@superplus/db';

interface ApprovalPendingProps {
  userId: string;
}

type PendingMarkdown = Markdown & {
  product: { name: string; cost_price: number | null } | null;
};

export function ApprovalPending({ userId }: ApprovalPendingProps) {
  const supabase = useSupabase();
  const [markdowns, setMarkdowns] = useState<PendingMarkdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingApprovals(supabase);
      setMarkdowns(data);
    } catch (err) {
      console.error('Failed to fetch pending approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = useCallback(
    async (markdownId: string) => {
      setActionId(markdownId);
      try {
          await approveMarkdown(supabase, markdownId, userId);
        setSuccessMsg('Markdown approved');
        fetchPending();
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err) {
        console.error('Failed to approve markdown:', err);
      } finally {
        setActionId(null);
      }
    },
    [userId, fetchPending]
  );

  const handleReject = useCallback(
    async (markdownId: string) => {
      setActionId(markdownId);
      try {
          await endMarkdown(supabase, markdownId);
        setSuccessMsg('Markdown rejected');
        fetchPending();
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err) {
        console.error('Failed to reject markdown:', err);
      } finally {
        setActionId(null);
      }
    },
    [fetchPending]
  );

  if (loading) {
    return <LoadingState message="Loading pending approvals..." />;
  }

  if (markdowns.length === 0) {
    return (
      <EmptyState
        title="No Pending Approvals"
        description="Below-cost markdowns requiring approval will appear here"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        {markdowns.length} markdown{markdowns.length !== 1 ? 's' : ''} awaiting approval
      </p>

      {markdowns.map((md) => {
        const costPrice = md.product?.cost_price ?? 0;
        const marginImpact =
          costPrice > 0
            ? ((md.markdown_price - costPrice) / md.markdown_price) * 100
            : null;

        return (
          <div key={md.id} className="bg-surface border border-danger/30 rounded-card p-4 space-y-3">
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

              <StatusBadge label="Below Cost" variant="danger" size="sm" />
            </div>

            {/* Margin impact info */}
            <div className="bg-danger/5 rounded-card px-4 py-3 space-y-1">
              {costPrice > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Cost Price</span>
                  <span className="font-medium text-text-primary">${costPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Markdown Price</span>
                <span className="font-medium text-danger">${md.markdown_price.toFixed(2)}</span>
              </div>
              {marginImpact !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Margin</span>
                  <span className={`font-bold ${marginImpact < 0 ? 'text-danger' : 'text-warning'}`}>
                    {marginImpact.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Reason</span>
                <span className="font-medium text-text-primary capitalize">
                  {md.reason.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(md.id)}
                disabled={actionId === md.id}
                className="flex-1 py-3 px-4 bg-success text-white text-sm font-medium rounded-button hover:bg-success/90 disabled:opacity-50 transition-colors"
              >
                {actionId === md.id ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(md.id)}
                disabled={actionId === md.id}
                className="flex-1 py-3 px-4 bg-danger text-white text-sm font-medium rounded-button hover:bg-danger/90 disabled:opacity-50 transition-colors"
              >
                {actionId === md.id ? 'Processing...' : 'Reject'}
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
