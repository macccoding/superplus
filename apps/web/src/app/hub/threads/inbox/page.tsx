'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const views = [
  { key: 'ALL', label: 'All', icon: 'inbox' },
  { key: 'URGENT', label: 'Urgent', icon: 'priority_high' },
  { key: 'NO_REPLY', label: 'No Reply', icon: 'mark_chat_unread' },
  { key: 'NEEDS_TASK', label: 'Needs Task', icon: 'add_task' },
  { key: 'STALE', label: 'Close?', icon: 'task_alt' },
] as const;

export default function SupervisorThreadInboxPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [view, setView] = useState<typeof views[number]['key']>('ALL');
  const { data: items, isLoading, isError } = trpc.threads.supervisorInbox.useQuery({ view });
  const resolve = trpc.threads.resolve.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const togglePin = trpc.threads.togglePin.useMutation({ onSuccess: () => utils.threads.invalidate() });

  return (
    <div className="px-5 py-6 pb-24">
      <button onClick={() => router.push('/hub/threads')} className="mb-4 flex items-center gap-1 text-sm text-on-surface-secondary">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Threads
      </button>
      <div className="mb-4">
        <h2 className="text-2xl font-extrabold text-on-surface">Supervisor Inbox</h2>
        <p className="mt-1 text-sm font-bold text-on-surface-secondary">Store threads that need attention</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {views.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`min-h-11 shrink-0 rounded-[--radius-lg] px-3 text-sm font-bold flex items-center gap-2 ${view === item.key ? 'bg-brand text-on-brand' : 'bg-surface-white text-on-surface-secondary'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-[--radius-lg] bg-warning/10 p-4 text-sm font-bold text-warning">Could not load inbox.</div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
              <button onClick={() => router.push(item.href)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.severity === 'high' ? 'bg-brand/10 text-brand' : item.severity === 'medium' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-on-surface">{item.title}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface-secondary">{item.subtitle}</p>
                  </div>
                </div>
              </button>
              {item.threadId && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button onClick={() => router.push(item.href)} className="min-h-10 rounded-[--radius-lg] bg-navy/10 text-navy text-xs font-bold">Open</button>
                  <button onClick={() => togglePin.mutate({ id: item.threadId })} className="min-h-10 rounded-[--radius-lg] bg-warning/10 text-warning text-xs font-bold">Pin</button>
                  <button onClick={() => resolve.mutate({ id: item.threadId })} className="min-h-10 rounded-[--radius-lg] bg-success/10 text-success text-xs font-bold">Done</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[--radius-lg] bg-surface-white p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-[42px] text-success">check_circle</span>
          <p className="mt-2 font-extrabold text-on-surface">All clear</p>
          <p className="mt-1 text-sm font-bold text-on-surface-secondary">Nothing needs supervisor attention right now.</p>
        </div>
      )}
    </div>
  );
}
