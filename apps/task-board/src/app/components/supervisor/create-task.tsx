'use client';

import { useState, useEffect, useCallback } from 'react';
import { QuickAction, NotificationBanner } from '@superplus/ui';
import { useActiveStaff } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import { createTask } from '@superplus/db/queries/tasks';
import type { TaskPriority } from '@superplus/config';

interface CreateTaskProps {
  shiftDate: string;
  userId: string;
  prefill: {
    title: string;
    description: string;
    category: string;
    priority: TaskPriority;
  } | null;
  onCreated: () => void;
}

export function CreateTask({ shiftDate, userId, prefill, onCreated }: CreateTaskProps) {
  const supabase = useSupabase();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignee, setAssignee] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: staff } = useActiveStaff();

  // Apply template prefill
  useEffect(() => {
    if (prefill) {
      setTitle(prefill.title);
      setDescription(prefill.description);
      setCategory(prefill.category);
      setPriority(prefill.priority);
    }
  }, [prefill]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await createTask(supabase, {
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        priority,
        shift_date: shiftDate,
        assigned_by_user_id: userId,
        assigned_to_user_id: assignee || null,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('normal');
      setAssignee('');
      setCategory('');

      onCreated();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, priority, category, assignee, shiftDate, userId, onCreated]);

  return (
    <div className="bg-surface border border-gray-200 rounded-card p-4 space-y-4">
      <h3 className="font-heading font-semibold text-text-primary">Create Task</h3>

      {/* Title */}
      <div>
        <label htmlFor="task-title" className="block text-sm font-medium text-text-primary mb-1">
          Title *
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="task-desc" className="block text-sm font-medium text-text-primary mb-1">
          Description (optional)
        </label>
        <textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details..."
          rows={3}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
        />
      </div>

      {/* Priority selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Priority</label>
        <div className="flex gap-2">
          {(['low', 'normal', 'high'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 py-2.5 px-3 rounded-button text-sm font-medium border transition-colors capitalize ${
                priority === p
                  ? p === 'high'
                    ? 'bg-danger text-white border-danger'
                    : p === 'normal'
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-gray-500 text-white border-gray-500'
                  : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label htmlFor="task-assignee" className="block text-sm font-medium text-text-primary mb-1">
          Assign to (optional)
        </label>
        <select
          id="task-assignee"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        >
          <option value="">Unassigned (Available pool)</option>
          {staff?.map((member) => (
            <option key={member.id} value={member.user_id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="task-category" className="block text-sm font-medium text-text-primary mb-1">
          Category (optional)
        </label>
        <input
          id="task-category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., stock, cleaning, compliance"
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>

      {error && (
        <NotificationBanner type="error" message={error} onDismiss={() => setError(null)} />
      )}

      <QuickAction
        label="Create Task"
        variant="primary"
        loading={submitting}
        disabled={!title.trim()}
        onClick={handleSubmit}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        }
      />
    </div>
  );
}
