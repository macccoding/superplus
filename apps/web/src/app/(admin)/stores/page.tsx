'use client';

import { trpc } from '@/lib/trpc-client';

export default function StoresPage() {
  const { data: stores } = trpc.stores.list.useQuery();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Stores</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores?.map((store) => (
          <div key={store.id} className="bg-white rounded-[12px] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-[#1A1A2E] text-lg">{store.name}</h3>
                <p className="text-sm text-[#6B7280] mt-1">{store.address}</p>
                <p className="text-sm text-[#6B7280]">{store.parish}</p>
              </div>
              <span className={`w-3 h-3 rounded-full mt-1 ${store.isActive ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
            </div>
            {store.phone && (
              <p className="text-sm text-[#6B7280] mt-2">{store.phone}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
