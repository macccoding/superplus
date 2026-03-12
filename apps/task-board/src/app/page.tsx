'use client';

import { useState, useMemo, useCallback } from 'react';
import { AppShell, LoadingState } from '@superplus/ui';
import { useAuth } from '@superplus/auth';
import { hasMinRole } from '@superplus/config';
import { useShiftTasks } from '@superplus/db/hooks';
import { useRealtimeTasks } from '@superplus/db/realtime';
import { CreateTask } from './components/supervisor/create-task';
import { TaskTemplates } from './components/supervisor/task-templates';
import { TaskList } from './components/supervisor/task-list';
import { MyTasks } from './components/staff/my-tasks';
import { ShiftSummary } from './components/shift-summary';

export default function TaskBoardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<{
    title: string;
    description: string;
    category: string;
    priority: 'low' | 'normal' | 'high';
  } | null>(null);

  const { data: tasks, loading: tasksLoading, refetch } = useShiftTasks(shiftDate);

  // Listen for realtime task changes
  useRealtimeTasks(shiftDate, () => {
    refetch();
  });

  const isSupervisor = role ? hasMinRole(role, 'supervisor') : false;

  const summary = useMemo(() => {
    const all = tasks ?? [];
    return {
      total: all.length,
      done: all.filter((t) => t.status === 'done').length,
    };
  }, [tasks]);

  const handleTemplateSelect = useCallback(
    (template: { title: string; description: string; category: string; priority: 'low' | 'normal' | 'high' }) => {
      setTemplatePrefill(template);
      setShowCreateForm(true);
    },
    []
  );

  const handleTaskCreated = useCallback(() => {
    setShowCreateForm(false);
    setTemplatePrefill(null);
    refetch();
  }, [refetch]);

  if (authLoading || tasksLoading) {
    return (
      <AppShell title="Task Board">
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Task Board"
      headerRight={
        isSupervisor ? (
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setTemplatePrefill(null);
            }}
            className="text-sm text-white/90 hover:text-white font-medium px-3 py-1 rounded-button hover:bg-white/10 transition-colors"
          >
            {showCreateForm ? 'Close' : '+ New Task'}
          </button>
        ) : null
      }
    >
      {/* Date selector */}
      <div className="mb-4">
        <label htmlFor="shift-date" className="block text-sm font-medium text-text-primary mb-1">
          Shift Date
        </label>
        <input
          id="shift-date"
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>

      {/* Supervisor view */}
      {isSupervisor ? (
        <div className="space-y-4">
          {showCreateForm ? (
            <div className="space-y-4">
              <TaskTemplates onSelect={handleTemplateSelect} />
              <CreateTask
                shiftDate={shiftDate}
                userId={user?.id ?? ''}
                prefill={templatePrefill}
                onCreated={handleTaskCreated}
              />
            </div>
          ) : (
            <TaskList
              tasks={tasks ?? []}
              shiftDate={shiftDate}
              onUpdate={refetch}
            />
          )}
        </div>
      ) : (
        /* Staff view */
        <MyTasks
          tasks={tasks ?? []}
          userId={user?.id ?? ''}
          onUpdate={refetch}
        />
      )}

      {/* Shift summary */}
      <ShiftSummary completed={summary.done} total={summary.total} />
    </AppShell>
  );
}
