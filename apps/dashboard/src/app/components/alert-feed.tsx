'use client';

import { useState } from 'react';
import { useUnresolvedStockouts, useIssues, useActiveMarkdowns } from '@superplus/db/hooks';
import { format, formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type: 'stockout' | 'issue' | 'markdown' | 'checklist';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  actionLabel?: string;
  actionHref?: string;
}

const severityConfig: Record<string, { bg: string; border: string; icon: string; dot: string }> = {
  critical: { bg: 'bg-danger/5', border: 'border-danger/20', icon: 'text-danger', dot: 'bg-danger' },
  high: { bg: 'bg-warning/5', border: 'border-warning/20', icon: 'text-warning', dot: 'bg-warning' },
  medium: { bg: 'bg-brand-accent/5', border: 'border-brand-accent/20', icon: 'text-brand-accent', dot: 'bg-brand-accent' },
  low: { bg: 'bg-brand-secondary/5', border: 'border-brand-secondary/20', icon: 'text-brand-secondary', dot: 'bg-brand-secondary' },
};

function AlertIcon({ type }: { type: Alert['type'] }) {
  switch (type) {
    case 'stockout':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 9.4l-9-5.19" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <line x1="3.27" y1="6.96" x2="12" y2="12.01" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'issue':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'markdown':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'checklist':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      );
  }
}

export function AlertFeed() {
  const { data: stockouts } = useUnresolvedStockouts();
  const { data: issues } = useIssues({ status: 'open' });
  const { data: markdowns } = useActiveMarkdowns();
  const [showAll, setShowAll] = useState(false);

  // Build alerts list from live data
  const alerts: Alert[] = [];

  // Unresolved stockouts
  stockouts?.forEach((event) => {
    alerts.push({
      id: `stockout-${event.id}`,
      type: 'stockout',
      severity: 'high',
      message: `${(event as any).product?.name ?? 'Unknown product'} is out of stock`,
      timestamp: event.created_at,
      actionLabel: 'View',
      actionHref: `/inventory`,
    });
  });

  // Open issues (critical/high only)
  issues
    ?.filter((issue) => issue.severity === 'critical' || issue.severity === 'high')
    .forEach((issue) => {
      alerts.push({
        id: `issue-${issue.id}`,
        type: 'issue',
        severity: issue.severity as 'critical' | 'high',
        message: `${issue.title} (${issue.issue_type})`,
        timestamp: issue.created_at,
        actionLabel: 'Review',
        actionHref: `/operations/issues`,
      });
    });

  // Below-cost markdowns pending approval
  markdowns
    ?.filter((md) => !md.approved_by_user_id && md.markdown_price < (md.original_price * 0.5))
    .forEach((md) => {
      alerts.push({
        id: `markdown-${md.id}`,
        type: 'markdown',
        severity: 'medium',
        message: `Below-cost markdown pending approval: ${(md as any).product?.name ?? 'Unknown'}`,
        timestamp: md.created_at,
        actionLabel: 'Approve',
        actionHref: `/pricing`,
      });
    });

  // Sort by severity then timestamp
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const displayedAlerts = showAll ? alerts : alerts.slice(0, 5);

  if (alerts.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-gray-100 p-6">
        <h3 className="text-base font-heading font-semibold text-text-primary mb-4">Alert Feed</h3>
        <div className="text-center py-8">
          <svg
            className="w-10 h-10 text-success mx-auto mb-2"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm text-text-secondary">All clear! No critical alerts right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-heading font-semibold text-text-primary">
          Alert Feed
          <span className="ml-2 text-xs font-normal text-text-secondary">
            ({alerts.length} active)
          </span>
        </h3>
      </div>

      <div className="space-y-3">
        {displayedAlerts.map((alert) => {
          const config = severityConfig[alert.severity] ?? severityConfig.low;
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
            >
              <div className={`flex-shrink-0 mt-0.5 ${config.icon}`}>
                <AlertIcon type={alert.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{alert.message}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                </p>
              </div>
              {alert.actionHref && (
                <a
                  href={alert.actionHref}
                  className="flex-shrink-0 text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  {alert.actionLabel}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {alerts.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 py-2 text-sm text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${alerts.length} alerts`}
        </button>
      )}
    </div>
  );
}
