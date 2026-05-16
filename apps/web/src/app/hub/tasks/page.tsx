'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { TaskCard, EmptyState } from '@superplus/ui';

type Tab = 'mine' | 'available' | 'all';

export default function TasksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');

  const { data: myTasks } = trpc.tasks.list.useQuery(
    { assignedToMe: true },
    { enabled: tab === 'mine' }
  );
  const { data: availableTasks } = trpc.tasks.list.useQuery(
    { unassigned: true },
    { enabled: tab === 'available' }
  );
  const { data: allTasks } = trpc.tasks.list.useQuery(
    undefined,
    { enabled: tab === 'all' }
  );

  const tasks = tab === 'mine' ? myTasks : tab === 'available' ? availableTasks : allTasks;

  return (
    <div>
      <div className="flex bg-white border-b border-gray-100 px-4">
        {(['mine', 'available', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[#E31837] text-[#E31837]'
                : 'border-transparent text-[#6B7280]'
            }`}
          >
            {t === 'mine' ? 'My Tasks' : t === 'available' ? 'Pick Up' : 'All'}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {tasks && tasks.length > 0 ? (
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
            icon="📋"
            title={tab === 'available' ? 'No tasks to pick up' : 'No tasks yet'}
            description={tab === 'available' ? 'All tasks are assigned' : undefined}
          />
        )}
      </div>

      <button
        onClick={() => router.push('/hub/tasks/create')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#E31837] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
