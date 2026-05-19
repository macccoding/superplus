import type { ReactNode } from 'react';

interface LogEntryCardProps {
  body: string;
  author: string;
  category: string;
  isFlagged: boolean;
  isResolved?: boolean;
  isUnread?: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  actions?: ReactNode;
  details?: ReactNode;
}

const categoryMeta: Record<string, { icon: string; label: string; tone: string }> = {
  GENERAL: { icon: 'notes', label: 'General', tone: 'bg-surface text-on-surface-secondary' },
  INCIDENT: { icon: 'warning', label: 'Incident', tone: 'bg-danger/10 text-danger' },
  HANDOVER: { icon: 'swap_horiz', label: 'Handover', tone: 'bg-navy/10 text-navy' },
  INVENTORY: { icon: 'inventory_2', label: 'Inventory', tone: 'bg-warning/15 text-warning' },
};

export function LogEntryCard({
  body,
  author,
  category,
  isFlagged,
  isResolved = false,
  isUnread = false,
  resolvedBy,
  resolvedAt,
  createdAt,
  actions,
  details,
}: LogEntryCardProps) {
  const meta = categoryMeta[category] || categoryMeta.GENERAL;
  const isOpen = isFlagged && !isResolved;

  return (
    <div className={`bg-surface-white rounded-[--radius-lg] p-4 shadow-[--shadow-card] ${isOpen ? 'border-l-4 border-l-danger' : isResolved ? 'border-l-4 border-l-success' : ''}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`material-symbols-outlined flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-md] text-[20px] ${meta.tone}`}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold text-on-surface">{author}</span>
              <span className="text-xs font-bold text-on-surface-secondary">{meta.label}</span>
            </div>
            <span className="text-xs text-outline">{createdAt}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {isUnread && (
            <span className="rounded-full bg-navy px-2 py-1 text-xs font-bold text-on-brand">New</span>
          )}
          {isOpen && (
            <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-xs font-bold text-danger">
              <span className="material-symbols-outlined text-[14px]">flag</span>
              Open
            </span>
          )}
          {isResolved && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Done
            </span>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-on-surface">{body}</p>
      {isResolved && resolvedBy && (
        <p className="mt-3 text-xs font-medium text-on-surface-secondary">
          Resolved by {resolvedBy}{resolvedAt ? ` at ${resolvedAt}` : ''}
        </p>
      )}
      {actions && <div className="mt-4 grid grid-cols-2 gap-2">{actions}</div>}
      {details && <div className="mt-4 space-y-3">{details}</div>}
    </div>
  );
}
