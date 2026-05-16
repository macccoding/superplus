import { serverTrpc } from '@/lib/trpc-server';

export default async function AdminDashboardPage() {
  const trpc = await serverTrpc();
  const stores = await trpc.stores.list();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-on-surface">Dashboard</h1>
        <p className="text-on-surface-variant mt-1">Cross-store overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">store</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stores.length}</p>
              <p className="text-sm text-on-surface-variant">Active Stores</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">group</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">--</p>
              <p className="text-sm text-on-surface-variant">Staff Members</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success">check_circle</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">--</p>
              <p className="text-sm text-on-surface-variant">Tasks Completed Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Store cards */}
      <h2 className="text-lg font-bold text-on-surface mb-4">Stores</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store: any) => (
          <div key={store.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-on-surface text-lg">{store.name}</h3>
                <p className="text-sm text-on-surface-variant mt-1">{store.parish}</p>
              </div>
              <div className={`w-3 h-3 rounded-full mt-1 ${store.isActive ? 'bg-success' : 'bg-error'}`} />
            </div>
            <p className="text-sm text-outline mt-3">{store.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
