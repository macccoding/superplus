'use client';

import { useState, useCallback } from 'react';
import { StatusBadge, getStatusVariant, QuickAction, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { updateIssueStatus } from '@superplus/db/queries/issues';
import { hasMinRole } from '@superplus/config';
import type { Issue } from '@superplus/db';
import type { Role } from '@superplus/config';

interface IssueDetailProps {
  issue: Issue;
  userId: string;
  userRole: Role | null;
  onBack: () => void;
  onUpdated: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  equipment: 'Equipment',
  supplier: 'Supplier',
  customer: 'Customer',
  staff: 'Staff',
  safety: 'Safety',
  other: 'Other',
};

const STATUS_STEPS: { status: Issue['status']; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'resolved', label: 'Resolved' },
];

export function IssueDetail({ issue, userId, userRole, onBack, onUpdated }: IssueDetailProps) {
  const supabase = useSupabase();
  const [newStatus, setNewStatus] = useState<Issue['status']>(issue.status);
  const [resolutionNotes, setResolutionNotes] = useState(issue.resolution_notes ?? '');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupervisor = userRole ? hasMinRole(userRole, 'supervisor') : false;

  const handleUpdateStatus = useCallback(async () => {
    if (newStatus === issue.status && !resolutionNotes.trim()) return;

    setUpdating(true);
    setError(null);

    try {
      await updateIssueStatus(supabase, issue.id, {
        status: newStatus,
        resolvedByUserId: newStatus === 'resolved' ? userId : undefined,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      onUpdated();
    } catch (err) {
      console.error('Failed to update issue:', err);
      setError('Failed to update issue. Please try again.');
    } finally {
      setUpdating(false);
    }
  }, [issue.id, issue.status, newStatus, resolutionNotes, userId, onUpdated]);

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === issue.status);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-brand-primary font-medium"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to list
      </button>

      {/* Issue header */}
      <div className="bg-surface border border-gray-200 rounded-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-heading font-bold text-text-primary">{issue.title}</h2>
          <StatusBadge
            label={issue.severity}
            variant={
              issue.severity === 'critical' || issue.severity === 'high'
                ? 'danger'
                : issue.severity === 'medium'
                ? 'warning'
                : 'neutral'
            }
            size="md"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge
            label={issue.status === 'in_progress' ? 'In Progress' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
            variant={getStatusVariant(issue.status)}
            size="sm"
            dot
          />
          <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full capitalize">
            {TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
          </span>
          <span className="text-xs text-text-secondary">
            Reported {new Date(issue.created_at).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {issue.description && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-text-primary whitespace-pre-wrap">{issue.description}</p>
          </div>
        )}

        {issue.photo_url && (
          <div className="pt-2">
            <img
              src={issue.photo_url}
              alt="Issue photo"
              className="w-full h-48 object-cover rounded-card border border-gray-200"
            />
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div className="bg-surface border border-gray-200 rounded-card p-4">
        <h3 className="text-sm font-medium text-text-primary mb-4">Status Timeline</h3>
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-4 left-8 right-8 h-0.5 bg-gray-200" />
          <div
            className="absolute top-4 left-8 h-0.5 bg-brand-primary transition-all duration-300"
            style={{ width: `${currentStepIndex * 50}%` }}
          />

          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.status} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-brand-primary border-brand-primary text-white'
                      : 'bg-surface border-gray-300 text-text-secondary'
                  } ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}
                >
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                <span className={`text-xs mt-2 font-medium ${isCompleted ? 'text-brand-primary' : 'text-text-secondary'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Update section (supervisor+) */}
      {isSupervisor && issue.status !== 'resolved' && (
        <div className="bg-surface border border-gray-200 rounded-card p-4 space-y-4">
          <h3 className="text-sm font-medium text-text-primary">Update Status</h3>

          {/* Status selector */}
          <div>
            <label className="block text-xs text-text-secondary mb-2">New Status</label>
            <div className="flex gap-2">
              {STATUS_STEPS.map((step) => (
                <button
                  key={step.status}
                  onClick={() => setNewStatus(step.status)}
                  className={`flex-1 py-2.5 px-3 rounded-button text-sm font-medium border transition-colors ${
                    newStatus === step.status
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution notes (when resolving) */}
          {newStatus === 'resolved' && (
            <div>
              <label htmlFor="resolution-notes" className="block text-xs text-text-secondary mb-1">
                Resolution Notes
              </label>
              <textarea
                id="resolution-notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="How was the issue resolved?"
                rows={3}
                className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
              />
            </div>
          )}

          {error && (
            <NotificationBanner type="error" message={error} onDismiss={() => setError(null)} />
          )}

          <QuickAction
            label="Save Changes"
            variant="primary"
            size="md"
            loading={updating}
            disabled={newStatus === issue.status && !resolutionNotes.trim()}
            onClick={handleUpdateStatus}
          />
        </div>
      )}

      {/* Resolution info (when resolved) */}
      {issue.status === 'resolved' && (
        <div className="bg-success/5 border border-success/20 rounded-card p-4 space-y-2">
          <h3 className="text-sm font-medium text-success">Resolved</h3>
          {issue.resolved_at && (
            <p className="text-xs text-text-secondary">
              Resolved on {new Date(issue.resolved_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          {issue.resolution_notes && (
            <p className="text-sm text-text-primary">{issue.resolution_notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
