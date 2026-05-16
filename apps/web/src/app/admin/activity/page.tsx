'use client';

import { trpc } from '@/lib/trpc-client';

export default function ActivityPage() {
  const { data } = trpc.activity.recent.useQuery();

  if (!data) return <div className="text-[#6B7280]">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Activity</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[12px] p-5 shadow-sm">
          <h2 className="font-bold text-[#1A1A2E] mb-4">Recent Tasks</h2>
          <div className="space-y-3">
            {data.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{task.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {task.store.name} · {task.createdBy.fullName}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  task.status === 'DONE' ? 'bg-green-100 text-[#2ECC71]' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-[#6B7280]'
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[12px] p-5 shadow-sm">
          <h2 className="font-bold text-[#1A1A2E] mb-4">Active Threads</h2>
          <div className="space-y-3">
            {data.threads.map((thread) => (
              <div key={thread.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{thread.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {thread.store.name} · {thread._count.messages} messages
                  </p>
                </div>
                <span className="text-xs text-[#6B7280]">
                  {thread.updatedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[12px] p-5 shadow-sm lg:col-span-2">
          <h2 className="font-bold text-[#E74C3C] mb-4">Flagged for Attention</h2>
          {data.flaggedLogs.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No flagged items</p>
          ) : (
            <div className="space-y-3">
              {data.flaggedLogs.map((log) => (
                <div key={log.id} className="border-l-4 border-[#E74C3C] pl-3 py-2">
                  <p className="text-sm text-[#1A1A2E]">{log.body}</p>
                  <p className="text-xs text-[#6B7280] mt-1">
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
