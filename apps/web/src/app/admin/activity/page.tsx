'use client';

import { trpc } from '@/lib/trpc-client';

export default function ActivityPage() {
  const { data } = trpc.activity.recent.useQuery();

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-on-surface">Activity</h1>
        <p className="text-on-surface-variant mt-1">Cross-store feed</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tasks */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-secondary">assignment</span>
            <h2 className="font-bold text-on-surface text-lg">Recent Tasks</h2>
          </div>
          <div className="space-y-1">
            {data.tasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between py-3 border-b border-outline-variant/10 last:border-0">
                <div>
                  <p className="text-sm font-bold text-on-surface">{task.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {task.store.name} · {task.createdBy.fullName}
                  </p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  task.status === 'DONE' ? 'bg-success/10 text-success' :
                  task.status === 'IN_PROGRESS' ? 'bg-secondary-container text-on-secondary-container' :
                  'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {data.tasks.length === 0 && (
              <p className="text-sm text-outline py-4 text-center">No recent tasks</p>
            )}
          </div>
        </div>

        {/* Active threads */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-success">forum</span>
            <h2 className="font-bold text-on-surface text-lg">Active Threads</h2>
          </div>
          <div className="space-y-1">
            {data.threads.map((thread: any) => (
              <div key={thread.id} className="flex items-center justify-between py-3 border-b border-outline-variant/10 last:border-0">
                <div>
                  <p className="text-sm font-bold text-on-surface">{thread.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {thread.store.name} · {thread._count.messages} messages
                  </p>
                </div>
                <span className="text-xs text-outline">
                  {thread.updatedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
            {data.threads.length === 0 && (
              <p className="text-sm text-outline py-4 text-center">No active threads</p>
            )}
          </div>
        </div>

        {/* Flagged log entries */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-primary">flag</span>
            <h2 className="font-bold text-primary text-lg">Flagged for Attention</h2>
          </div>
          {data.flaggedLogs.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-sm text-outline">
              <span className="material-symbols-outlined">check_circle</span>
              No flagged items — all clear
            </div>
          ) : (
            <div className="space-y-1">
              {data.flaggedLogs.map((log: any) => (
                <div key={log.id} className="border-l-4 border-l-primary pl-4 py-3">
                  <p className="text-sm text-on-surface leading-relaxed">{log.body}</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {log.store.name} · {log.author.fullName} · {log.createdAt.toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
