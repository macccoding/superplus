'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const statusLabels: Record<string, string> = { DRAFT: 'Draft', ORDERED: 'Ordered', PARTIALLY_RECEIVED: 'Partial', RECEIVED: 'Received', CANCELLED: 'Cancelled' };
const statusColors: Record<string, string> = { DRAFT: 'bg-surface-container-high text-on-surface-variant', ORDERED: 'bg-secondary/10 text-secondary', PARTIALLY_RECEIVED: 'bg-tertiary-container/30 text-on-tertiary-container', RECEIVED: 'bg-success/10 text-success', CANCELLED: 'bg-outline/10 text-outline' };

export default function OrdersPage() {
  const router = useRouter();
  const { data: orders, isLoading } = trpc.orders.list.useQuery();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Purchase Orders</h1>
          <p className="text-on-surface-variant mt-1">{orders?.length || 0} orders</p>
        </div>
        <button onClick={() => router.push('/admin/orders/new')} className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-md">
          <span className="material-symbols-outlined text-[20px]">add</span>New Order
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {orders?.map((order: any) => (
            <button key={order.id} onClick={() => router.push(`/admin/orders/${order.id}`)} className="w-full text-left bg-surface-container-lowest rounded-xl p-5 shadow-sm active:scale-[0.98] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-on-surface">{order.orderNumber}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{order.supplier.name}</p>
                  <p className="text-xs text-outline mt-0.5">{order._count.items} items · Created {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                {order.totalAmount && (
                  <span className="text-lg font-bold text-on-surface">${Number(order.totalAmount).toFixed(2)}</span>
                )}
              </div>
            </button>
          ))}
          {orders?.length === 0 && <div className="text-center py-12 text-on-surface-variant">No purchase orders yet</div>}
        </div>
      )}
    </div>
  );
}
