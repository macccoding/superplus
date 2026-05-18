'use client';

import { trpc } from '@/lib/trpc-client';

export default function StoresPage() {
  const { data: stores } = trpc.stores.list.useQuery();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-surface">Stores</h1>
        <p className="text-on-surface-secondary mt-1">{stores?.length || 0} locations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores?.map((store) => (
          <div key={store.id} className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[--radius-lg] bg-navy/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-navy">store</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-lg">{store.name}</h3>
                  <p className="text-sm text-on-surface-secondary mt-0.5">{store.address}</p>
                  <p className="text-sm text-on-surface-secondary mt-0.5">{store.parish}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${store.isActive ? 'bg-success/10' : 'bg-error/10'}`}>
                <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-success' : 'bg-error'}`} />
                <span className={`text-xs font-medium ${store.isActive ? 'text-success' : 'text-error'}`}>
                  {store.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            {store.phone && (
              <div className="flex items-center gap-2 mt-4 text-sm text-on-surface-secondary">
                <span className="material-symbols-outlined text-[18px]">call</span>
                {store.phone}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
