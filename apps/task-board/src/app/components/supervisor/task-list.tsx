'use client';

import { useState, useCallback } from 'react';
import { StatusBadge, getStatusVariant, EmptyState, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { updateTaskStatus, assignTask } from '@superplus/db/queries/tasks';
import { useActiveStaff } from '@superplus/db/hooks';
import type { Task } from '@superplus/db';
import type { TaskStatus } from '@superplus/config';

interface TaskListProps {
  tasks: Task[];
  shiftDate: string;
  onUpdate: () => void;
}

type FilterStatus = 'all' | TaskStatus;

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-l-danger',
  normal: 'border-l-brand-primary',
  low: 'border-l-gray-300',
};

export function TaskList({ tasks, shiftDate, onUpdate }: TaskListProps) {
  const supabase = useSupabase();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: staff } = useActiveStaff();

  const filteredTasks = filterStatus === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus);

  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      setUpdatingId(taskId);
      try {
        await updateTaskStatus(supabase, taskId, newStatus);
        onUpdate();
      } catch (err) {
        console.error('Failed to update task status:', err);
      } finally {
        setUpdatingId(null);
      }
    },
    [onUpdate]
  );

  const handleReassign = useCallback(
    async (taskId: string, newAssignee: string) => {
      setUpdatingId(taskId);
      try {
        await assignTask(supabase, taskId, newAssignee);
        setEditingTask(null);
        setSuccessMsg('Task reassigned');
        onUpdate();
        setTimeout(() => setSuccessMsg(null), 2000);
      } catch (err) {
        console.error('Failed to reassign task:', err);
      } finally {
        setUpdatingId(null);
      }
    },
    [onUpdate]
  );

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No Tasks for This Shift"
        description="Create a new task to get started"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'pending', 'in_progress', 'done'] as const).map((status) => {
          const count =
            status === 'all' ? tasks.length : tasks.filter((t) => t.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterStatus === status
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface text-text-secondary border-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`bg-surface border border-gray-200 rounded-card p-4 border-l-4 ${PRIORITY_COLORS[task.priority]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-text-primary">{task.title}</p>
                {task.description && (
                  <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge
                    label={task.priority}
                    variant={task.priority === 'high' ? 'danger' : task.priority === 'normal' ? 'primary' : 'neutral'}
                    size="sm"
                  />
                  <StatusBadge
                    label={task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    variant={getStatusVariant(task.status)}
                    size="sm"
                    dot
                  />
                  {task.category && (
                    <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
                      {task.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <button
                onClick={() => setEditingTask(editingTask === task.id ? null : task.id)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-text-secondary transition-colors"
                aria-label="Edit task"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            </div>

            {/* Edit panel */}
            {editingTask === task.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                {/* Status change */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Change Status</label>
                  <div className="flex gap-2">
                    {(['pending', 'in_progress', 'done'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(task.id, status)}
                        disabled={task.status === status || updatingId === task.id}
                        className={`flex-1 py-2 text-xs font-medium rounded-button border transition-colors ${
                          task.status === status
                            ? 'bg-gray-100 text-text-secondary border-gray-200 opacity-50'
                            : 'bg-surface text-text-primary border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reassign */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Reassign</label>
                  <select
                    value={task.assigned_to_user_id ?? ''}
                    onChange={(e) => {
                      if (e.target.value) handleReassign(task.id, e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-surface border border-gray-200 rounded-input text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    <option value="">Unassigned</option>
                    {staff?.map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
