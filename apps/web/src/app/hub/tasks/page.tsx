'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { TaskCard, EmptyState } from '@superplus/ui';

type Tab = 'mine' | 'available' | 'all';

export default function TasksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');

  const { data: myTasks, isLoading: loadingMine } = trpc.tasks.list.useQuery(
    { assignedToMe: true },
    { enabled: tab === 'mine' }
  );
  const { data: availableTasks, isLoading: loadingAvailable } = trpc.tasks.list.useQuery(
    { unassigned: true },
    { enabled: tab === 'available' }
  );
  const { data: allTasks, isLoading: loadingAll } = trpc.tasks.list.useQuery(
    undefined,
    { enabled: tab === 'all' }
  );

  const tasks = tab === 'mine' ? myTasks : tab === 'available' ? availableTasks : allTasks;
  const isLoading = tab === 'mine' ? loadingMine : tab === 'available' ? loadingAvailable : loadingAll;

  return (
    <div>
      {/* Header + Tabs */}
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface mb-4">Tasks</h2>
        <div className="flex bg-surface-container-high rounded-xl p-1">
          {([
            { key: 'mine', label: 'My Tasks' },
            { key: 'available', label: 'Pick Up' },
            { key: 'all', label: 'All' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === key
                  ? 'bg-primary text-on-primary shadow-sm rounded-lg'
                  : 'text-on-surface-variant hover:bg-surface-container-highest rounded-lg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Task list */}
      <section className="px-[--spacing-container] pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
          </div>
        ) : tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              title={task.title}
              priority={task.priority}
              status={task.status}
              assignedTo={task.assignedTo?.fullName}
              createdBy={task.createdBy.fullName}
              dueDate={task.dueDate?.toLocaleDateString()}
              onClick={() => router.push(`/hub/tasks/${task.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon={tab === 'available' ? 'volunteer_activism' : 'assignment'}
            title={tab === 'available' ? 'No tasks to pick up' : 'No tasks yet'}
            description={tab === 'available' ? 'All tasks are assigned' : 'Tasks will appear here when created'}
          />
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => router.push('/hub/tasks/create')}
        className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
