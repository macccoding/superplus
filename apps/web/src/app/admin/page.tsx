'use client';

import { trpc } from '@/lib/trpc-client';

export default function AdminDashboardPage() {
  const { data: stores } = trpc.stores.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const { data: taskStats } = trpc.reports.taskPerformance.useQuery({ days: 1 });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-surface">Dashboard</h1>
        <p className="text-on-surface-secondary mt-1">Cross-store overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[--radius-lg] bg-brand/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-brand">store</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stores?.length ?? '--'}</p>
              <p className="text-sm text-on-surface-secondary">Active Stores</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[--radius-lg] bg-navy/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-navy">group</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{users?.length ?? '--'}</p>
              <p className="text-sm text-on-surface-secondary">Staff Members</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[--radius-lg] bg-success/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success">check_circle</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{taskStats?.completed ?? '--'}</p>
              <p className="text-sm text-on-surface-secondary">Tasks Completed Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Store cards */}
      <h2 className="text-lg font-bold text-on-surface mb-4">Stores</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores?.map((store: any) => (
          <div key={store.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-on-surface text-lg">{store.name}</h3>
                <p className="text-sm text-on-surface-secondary mt-1">{store.parish}</p>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${store.isActive ? 'bg-success/10' : 'bg-error/10'}`}>
                <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-success' : 'bg-error'}`} />
                <span className={`text-xs font-medium ${store.isActive ? 'text-success' : 'text-error'}`}>{store.isActive ? 'Active' : 'Closed'}</span>
              </div>
            </div>
            <p className="text-sm text-on-surface-secondary mt-3">{store.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
