'use client';

import { useMemo, useState, useEffect } from 'react';
import { useIssues } from '@superplus/db/hooks';
import type { Issue } from '@superplus/db';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { StatusBadge, getStatusVariant } from '@superplus/ui';
import { ISSUE_TYPES } from '@superplus/config';
import { PieChartWidget } from '../../components/charts/pie-chart';
import { BarChartWidget } from '../../components/charts/bar-chart';

export default function IssuesPage() {
  const { data: allIssues } = useIssues();
  const { data: openIssues } = useIssues({ status: 'open' });

  // Issue volume by type
  const issuesByType = useMemo(() => {
    if (!allIssues) return [];
    const typeCounts: Record<string, number> = {};
    allIssues.forEach((issue) => {
      const label = issue.issue_type.charAt(0).toUpperCase() + issue.issue_type.slice(1);
      typeCounts[label] = (typeCounts[label] ?? 0) + 1;
    });
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  }, [allIssues]);

  // Average resolution time
  const avgResolutionTime = useMemo(() => {
    if (!allIssues) return 0;
    const resolved = allIssues.filter((i) => i.status === 'resolved' && i.resolved_at);
    if (resolved.length === 0) return 0;

    const totalHours = resolved.reduce((sum, i) => {
      return sum + differenceInHours(new Date(i.resolved_at!), new Date(i.created_at));
    }, 0);

    return Math.round(totalHours / resolved.length);
  }, [allIssues]);

  // Recurring issues
  const recurringIssues = useMemo(() => {
    if (!allIssues) return [];
    const titleCounts: Record<string, { count: number; title: string; type: string }> = {};
    allIssues.forEach((i) => {
      const key = i.title.toLowerCase().trim();
      if (!titleCounts[key]) {
        titleCounts[key] = { count: 0, title: i.title, type: i.issue_type };
      }
      titleCounts[key].count++;
    });
    return Object.values(titleCounts)
      .filter((tc) => tc.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allIssues]);

  // Open issues sorted by severity
  const sortedOpenIssues = useMemo(() => {
    if (!openIssues) return [];
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...openIssues].sort(
      (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );
  }, [openIssues]);

  const severityLabel: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Total Issues</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">
            {allIssues?.length ?? 0}
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Open Issues</p>
          <p className="text-2xl font-heading font-bold text-warning mt-1">
            {openIssues?.length ?? 0}
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Avg Resolution Time</p>
          <p className="text-2xl font-heading font-bold text-text-primary mt-1">
            {avgResolutionTime}h
          </p>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <p className="text-sm text-text-secondary">Critical Open</p>
          <p className="text-2xl font-heading font-bold text-danger mt-1">
            {openIssues?.filter((i) => i.severity === 'critical').length ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Issues by Type */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Issue Volume by Type
          </h2>
          <PieChartWidget
            data={issuesByType}
            dataKey="value"
            nameKey="name"
            height={300}
          />
        </div>

        {/* Recurring Issues */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Recurring Issues
          </h2>
          {recurringIssues.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              No recurring issues detected
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {recurringIssues.map((ri, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                  <span className="flex-shrink-0 text-sm font-bold text-text-secondary w-6">
                    {ri.count}x
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{ri.title}</p>
                    <p className="text-xs text-text-secondary capitalize">{ri.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open Issues List */}
      <div className="bg-surface rounded-card border border-gray-100 p-6">
        <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
          Open Issues by Severity
        </h2>
        {sortedOpenIssues.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">
            No open issues at this time
          </p>
        ) : (
          <div className="space-y-3">
            {sortedOpenIssues.map((issue) => (
              <div
                key={issue.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  issue.severity === 'critical'
                    ? 'bg-danger/5 border-danger/20'
                    : issue.severity === 'high'
                    ? 'bg-warning/5 border-warning/20'
                    : 'bg-background border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium text-text-primary">{issue.title}</h3>
                    <StatusBadge
                      label={severityLabel[issue.severity] ?? issue.severity}
                      variant={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : 'warning'}
                      size="sm"
                    />
                    <StatusBadge
                      label={issue.issue_type}
                      variant="neutral"
                      size="sm"
                    />
                  </div>
                  {issue.description && (
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {issue.description}
                    </p>
                  )}
                  <p className="text-xs text-text-secondary mt-1">
                    Reported {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
