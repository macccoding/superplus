'use client';

import { useMemo } from 'react';
import { EmptyState } from '@superplus/ui';
import type { Task } from '@superplus/db';
import { TaskCard } from './task-card';

interface MyTasksProps {
  tasks: Task[];
  userId: string;
  onUpdate: () => void;
}

export function MyTasks({ tasks, userId, onUpdate }: MyTasksProps) {
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to_user_id === userId),
    [tasks, userId]
  );

  const availableTasks = useMemo(
    () => tasks.filter((t) => !t.assigned_to_user_id),
    [tasks]
  );

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No Tasks for This Shift"
        description="Tasks will appear here when assigned"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* My assigned tasks */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
          My Tasks ({myTasks.length})
        </h3>
        {myTasks.length > 0 ? (
          <div className="space-y-2">
            {myTasks.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary bg-gray-50 rounded-card p-4 text-center">
            No tasks assigned to you yet
          </p>
        )}
      </div>

      {/* Available tasks */}
      {availableTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
            Available ({availableTasks.length})
          </h3>
          <div className="space-y-2">
            {availableTasks.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
