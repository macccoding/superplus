'use client';

import { useState, useCallback } from 'react';
import { StatusBadge, getStatusVariant } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { updateTaskStatus } from '@superplus/db/queries/tasks';
import type { Task } from '@superplus/db';
import type { TaskStatus } from '@superplus/config';

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
};

const STATUS_ACTION_LABEL: Record<TaskStatus, string> = {
  pending: 'Start',
  in_progress: 'Complete',
  done: 'Reopen',
};

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-4 border-l-danger',
  normal: 'border-l-4 border-l-brand-primary',
  low: 'border-l-4 border-l-gray-300',
};

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const supabase = useSupabase();
  const [updating, setUpdating] = useState(false);

  const handleToggleStatus = useCallback(async () => {
    setUpdating(true);
    try {
      const nextStatus = NEXT_STATUS[task.status];
      await updateTaskStatus(supabase, task.id, nextStatus);
      onUpdate();
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setUpdating(false);
    }
  }, [task.id, task.status, onUpdate]);

  const isDone = task.status === 'done';

  return (
    <button
      onClick={handleToggleStatus}
      disabled={updating}
      className={`w-full text-left bg-surface border border-gray-200 rounded-card p-4 transition-all ${
        PRIORITY_BORDER[task.priority]
      } ${isDone ? 'opacity-60' : ''} hover:shadow-md active:shadow-sm disabled:opacity-50`}
    >
      <div className="flex items-start gap-3">
        {/* Status circle */}
        <div
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isDone
              ? 'bg-success border-success'
              : task.status === 'in_progress'
              ? 'bg-warning/20 border-warning'
              : 'bg-surface border-gray-300'
          }`}
        >
          {isDone && (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {task.status === 'in_progress' && (
            <div className="w-2.5 h-2.5 bg-warning rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-heading font-semibold text-text-primary ${isDone ? 'line-through' : ''}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge
              label={task.priority}
              variant={task.priority === 'high' ? 'danger' : task.priority === 'normal' ? 'primary' : 'neutral'}
              size="sm"
            />
            {task.category && (
              <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
                {task.category}
              </span>
            )}
          </div>
        </div>

        {/* Action hint */}
        <span className={`text-xs font-medium flex-shrink-0 ${
          isDone ? 'text-success' : task.status === 'in_progress' ? 'text-warning' : 'text-brand-primary'
        }`}>
          {updating ? '...' : STATUS_ACTION_LABEL[task.status]}
        </span>
      </div>
    </button>
  );
}
