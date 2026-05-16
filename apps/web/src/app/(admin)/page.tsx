import { serverTrpc } from '@/lib/trpc-server';

export default async function AdminDashboardPage() {
  const trpc = await serverTrpc();
  const stores = await trpc.stores.list();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <div key={store.id} className="bg-white rounded-[12px] p-5 shadow-sm">
            <h3 className="font-bold text-[#1A1A2E]">{store.name}</h3>
            <p className="text-sm text-[#6B7280] mt-1">{store.parish}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
              <span className="text-xs text-[#6B7280]">{store.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
