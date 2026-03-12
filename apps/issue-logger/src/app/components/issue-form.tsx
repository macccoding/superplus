'use client';

import { useState, useCallback } from 'react';
import { QuickAction, PhotoCapture, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { createIssue } from '@superplus/db/queries/issues';
import { ISSUE_TYPES, SEVERITY_LEVELS } from '@superplus/config';
import type { IssueType, SeverityLevel } from '@superplus/config';

interface IssueFormProps {
  userId: string;
  onCreated: () => void;
}

const ISSUE_TYPE_ICONS: Record<IssueType, { label: string; icon: string }> = {
  equipment: { label: 'Equipment', icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' },
  supplier: { label: 'Supplier', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  customer: { label: 'Customer', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  staff: { label: 'Staff', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  safety: { label: 'Safety', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  other: { label: 'Other', icon: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z' },
};

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; border: string; text: string }> = {
  low: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-text-secondary' },
  medium: { bg: 'bg-warning/10', border: 'border-warning', text: 'text-warning' },
  high: { bg: 'bg-danger/10', border: 'border-danger/50', text: 'text-danger' },
  critical: { bg: 'bg-danger/20', border: 'border-danger', text: 'text-danger' },
};

export function IssueForm({ userId, onCreated }: IssueFormProps) {
  const supabase = useSupabase();
  const [issueType, setIssueType] = useState<IssueType | ''>('');
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!issueType) {
      setError('Please select an issue type');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await createIssue(supabase, {
        issue_type: issueType,
        severity,
        title: title.trim(),
        description: description.trim() || null,
        reported_by_user_id: userId,
        status: 'open',
      });

      setSuccess(true);
      // Reset form
      setIssueType('');
      setSeverity('medium');
      setTitle('');
      setDescription('');
      setPhotoFile(null);

      setTimeout(() => {
        setSuccess(false);
        onCreated();
      }, 1500);
    } catch (err) {
      console.error('Failed to create issue:', err);
      setError('Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [issueType, severity, title, description, userId, onCreated]);

  if (success) {
    return (
      <NotificationBanner
        type="success"
        message="Issue reported successfully"
        autoDismissMs={2000}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Issue type selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Issue Type</label>
        <div className="grid grid-cols-3 gap-2">
          {ISSUE_TYPES.map((type) => {
            const config = ISSUE_TYPE_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => setIssueType(type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-card border-2 transition-all ${
                  issueType === type
                    ? 'border-brand-primary bg-brand-primary/5'
                    : 'border-gray-200 bg-surface hover:border-gray-300'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={issueType === type ? 'text-brand-primary' : 'text-text-secondary'}
                >
                  <path d={config.icon} />
                </svg>
                <span className={`text-xs font-medium ${
                  issueType === type ? 'text-brand-primary' : 'text-text-secondary'
                }`}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Severity</label>
        <div className="flex gap-2">
          {SEVERITY_LEVELS.map((level) => {
            const colors = SEVERITY_COLORS[level];
            return (
              <button
                key={level}
                onClick={() => setSeverity(level)}
                className={`flex-1 py-3 px-3 rounded-button text-sm font-medium border-2 transition-colors capitalize ${
                  severity === level
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Critical warning */}
      {severity === 'critical' && (
        <NotificationBanner
          type="warning"
          message="Critical issues will immediately notify management"
        />
      )}

      {/* Title */}
      <div>
        <label htmlFor="issue-title" className="block text-sm font-medium text-text-primary mb-1">
          Title *
        </label>
        <input
          id="issue-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the issue"
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="issue-desc" className="block text-sm font-medium text-text-primary mb-1">
          Description (optional)
        </label>
        <textarea
          id="issue-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide more detail about the issue..."
          rows={4}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
        />
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Photo (optional)
        </label>
        <PhotoCapture
          onCapture={(file) => setPhotoFile(file)}
          label="Add Photo Evidence"
        />
      </div>

      {/* Error */}
      {error && (
        <NotificationBanner type="error" message={error} onDismiss={() => setError(null)} />
      )}

      {/* Submit */}
      <QuickAction
        label="Submit Issue"
        variant={severity === 'critical' ? 'danger' : 'primary'}
        loading={submitting}
        disabled={!issueType || !title.trim()}
        onClick={handleSubmit}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        }
      />
    </div>
  );
}
