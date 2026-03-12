'use client';

import { useState, useCallback, useMemo } from 'react';
import { StatusBadge, getStatusVariant, LoadingState, EmptyState } from '@superplus/ui';
import { useIssues } from '@superplus/db/hooks';
import { useRealtimeIssues } from '@superplus/db/realtime';
import type { Issue } from '@superplus/db';
import type { Role, IssueType, SeverityLevel } from '@superplus/config';
import { ISSUE_TYPES, SEVERITY_LEVELS } from '@superplus/config';
import { IssueDetail } from './issue-detail';

interface IssueListProps {
  statusFilter: Issue['status'][];
  userId: string;
  userRole: Role | null;
}

const TYPE_LABELS: Record<IssueType, string> = {
  equipment: 'Equipment',
  supplier: 'Supplier',
  customer: 'Customer',
  staff: 'Staff',
  safety: 'Safety',
  other: 'Other',
};

export function IssueList({ statusFilter, userId, userRole }: IssueListProps) {
  const { data: allIssues, loading, refetch } = useIssues();
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useRealtimeIssues(() => {
    refetch();
  });

  const filteredIssues = useMemo(() => {
    let result = (allIssues ?? []).filter((issue) => statusFilter.includes(issue.status));
    if (typeFilter !== 'all') {
      result = result.filter((issue) => issue.issue_type === typeFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter((issue) => issue.severity === severityFilter);
    }
    return result;
  }, [allIssues, statusFilter, typeFilter, severityFilter]);

  const handleIssueUpdated = useCallback(() => {
    setSelectedIssue(null);
    refetch();
  }, [refetch]);

  if (loading) {
    return <LoadingState message="Loading issues..." />;
  }

  // Show detail view
  if (selectedIssue) {
    return (
      <IssueDetail
        issue={selectedIssue}
        userId={userId}
        userRole={userRole}
        onBack={() => setSelectedIssue(null)}
        onUpdated={handleIssueUpdated}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="space-y-2">
        {/* Type filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === 'all'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-secondary border-gray-200'
            }`}
          >
            All Types
          </button>
          {ISSUE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === type
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface text-text-secondary border-gray-200'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              severityFilter === 'all'
                ? 'bg-brand-secondary text-white border-brand-secondary'
                : 'bg-surface text-text-secondary border-gray-200'
            }`}
          >
            All Severity
          </button>
          {SEVERITY_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSeverityFilter(level)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                severityFilter === level
                  ? 'bg-brand-secondary text-white border-brand-secondary'
                  : 'bg-surface text-text-secondary border-gray-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Issue list */}
      {filteredIssues.length === 0 ? (
        <EmptyState
          title={statusFilter.includes('resolved') ? 'No Resolved Issues' : 'No Open Issues'}
          description={statusFilter.includes('resolved') ? 'Resolved issues will appear here' : 'No issues match the current filters'}
        />
      ) : (
        <div className="space-y-2">
          {filteredIssues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setSelectedIssue(issue)}
              className="w-full text-left bg-surface border border-gray-200 rounded-card p-4 hover:shadow-md active:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-text-primary truncate">
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusBadge
                      label={issue.status === 'in_progress' ? 'In Progress' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                      variant={getStatusVariant(issue.status)}
                      size="sm"
                      dot
                    />
                    <StatusBadge
                      label={issue.severity}
                      variant={
                        issue.severity === 'critical' || issue.severity === 'high'
                          ? 'danger'
                          : issue.severity === 'medium'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    />
                    <span className="text-xs text-text-secondary capitalize">
                      {TYPE_LABELS[issue.issue_type]}
                    </span>
                  </div>
                </div>

                <span className="text-xs text-text-secondary flex-shrink-0">
                  {new Date(issue.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
