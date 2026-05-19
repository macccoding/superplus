'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const statusLabels: Record<string, string> = { DRAFT: 'Draft', ORDERED: 'Ordered', PARTIALLY_RECEIVED: 'Partial', RECEIVED: 'Received', CANCELLED: 'Cancelled' };
const statusColors: Record<string, string> = { DRAFT: 'bg-surface-cream text-on-surface-secondary', ORDERED: 'bg-navy/10 text-navy', PARTIALLY_RECEIVED: 'bg-warning/15 text-warning', RECEIVED: 'bg-success/10 text-success', CANCELLED: 'bg-outline/10 text-on-surface-secondary' };

export default function OrdersPage() {
  const router = useRouter();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: orders, isLoading } = trpc.orders.list.useQuery({ scope: activeScope, status: status === 'ALL' ? undefined : status as any });

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Purchase Orders</h1>
          <p className="text-on-surface-secondary mt-1">{orders?.length || 0} orders</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Order status">
            <option value="ALL">All Statuses</option>
            {Object.keys(statusLabels).map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}
          </select>
          <button onClick={() => router.push(`/admin/orders/new?scope=${activeScope === 'ALL' ? '' : activeScope}`)} className="col-span-2 h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md sm:col-span-1">
            <span className="material-symbols-outlined text-[20px]">add</span>New Order
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {orders?.map((order: any) => (
            <button key={order.id} onClick={() => router.push(`/admin/orders/${order.id}`)} className="w-full text-left bg-surface-white rounded-[--radius-lg] p-5 shadow-sm active:scale-[0.98] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-on-surface">{order.orderNumber}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                  </div>
                  <p className="text-sm text-on-surface-secondary mt-1">{order.supplier.name}</p>
                  <p className="text-xs text-on-surface-secondary mt-0.5">{order.store?.name} · {order._count.items} items · Created {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                {order.totalAmount && (
                  <span className="text-lg font-bold text-on-surface">${Number(order.totalAmount).toFixed(2)}</span>
                )}
              </div>
            </button>
          ))}
          {orders?.length === 0 && <div className="text-center py-12 text-on-surface-secondary">No purchase orders yet</div>}
        </div>
      )}
    </div>
  );
}
