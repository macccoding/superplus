'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const statusLabels: Record<string, string> = { DRAFT: 'Draft', ORDERED: 'Ordered', PARTIALLY_RECEIVED: 'Partial', RECEIVED: 'Received', CANCELLED: 'Cancelled' };
const statusColors: Record<string, string> = { DRAFT: 'bg-surface-cream text-on-surface-secondary', ORDERED: 'bg-navy/10 text-navy', PARTIALLY_RECEIVED: 'bg-warning/15 text-warning', RECEIVED: 'bg-success/10 text-success', CANCELLED: 'bg-outline/10 text-on-surface-secondary' };

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: order, isLoading } = trpc.orders.getById.useQuery({ id });
  const [receiving, setReceiving] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
  const [cancelNote, setCancelNote] = useState('');

  const updateStatus = trpc.orders.updateStatus.useMutation({ onSuccess: () => utils.orders.invalidate() });
  const receiveItems = trpc.orders.receiveItems.useMutation({ onSuccess: () => { utils.orders.invalidate(); setReceiving(false); } });
  const createTask = trpc.admin.createTaskFromAttention.useMutation({ onSuccess: () => { utils.admin.invalidate(); utils.tasks.invalidate(); } });

  if (isLoading) return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>;
  if (!order) return null;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Orders
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-on-surface">{order.orderNumber}</h1>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
          </div>
          <p className="text-on-surface-secondary mt-1">{order.supplier.name} · Created by {order.createdBy.fullName}</p>
        </div>
        {order.totalAmount && <p className="text-2xl font-bold text-on-surface">${Number(order.totalAmount).toFixed(2)}</p>}
      </div>

      {/* Actions */}
      {order.status === 'DRAFT' && (
        <div className="flex gap-3 mb-6">
          <button onClick={() => updateStatus.mutate({ id, status: 'ORDERED', scope: order.storeId })} className="h-12 px-5 bg-navy text-on-navy font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[20px]">send</span>Mark as Ordered
          </button>
          <button onClick={() => updateStatus.mutate({ id, status: 'CANCELLED', notes: cancelNote || undefined, scope: order.storeId })} className="h-12 px-5 bg-surface-cream text-on-surface-secondary font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all">Cancel</button>
        </div>
      )}
      {(order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && !receiving && (
        <div className="flex flex-col gap-3 sm:flex-row mb-6">
          <button onClick={() => { setReceiving(true); const qtys: Record<string, string> = {}; order.items.forEach((i: any) => { qtys[i.id] = String(i.receivedQty ?? ''); }); setReceivedQtys(qtys); }} className="h-12 px-5 bg-success text-white font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[20px]">inventory</span>Receive Goods
          </button>
          {order.status === 'PARTIALLY_RECEIVED' && (
            <button onClick={() => createTask.mutate({ scope: order.storeId, type: 'PURCHASE_ORDER', sourceId: id, title: `Follow up remaining items: ${order.orderNumber}` })} className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[20px]">assignment_add</span>Create Follow-up
            </button>
          )}
        </div>
      )}
      {order.status !== 'RECEIVED' && order.status !== 'CANCELLED' && (
        <input value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="Cancellation note (optional)" className="w-full max-w-md h-12 px-4 bg-surface-white border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-on-surface-secondary mb-6" />
      )}

      {/* Items table */}
      <div className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-outline/30">
                <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Product</th>
                <th className="text-center px-5 py-4 text-sm font-medium text-on-surface-secondary">Qty</th>
                <th className="text-right px-5 py-4 text-sm font-medium text-on-surface-secondary">Unit Cost</th>
                <th className="text-right px-5 py-4 text-sm font-medium text-on-surface-secondary">Total</th>
                {receiving && <th className="text-center px-5 py-4 text-sm font-medium text-on-surface-secondary">Received</th>}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => (
                <tr key={item.id} className="border-b border-outline/10">
                  <td className="px-5 py-4 text-sm font-medium text-on-surface">{item.productName}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-secondary text-center">{item.quantity}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-secondary text-right">${Number(item.unitCost).toFixed(2)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-on-surface text-right">${(item.quantity * Number(item.unitCost)).toFixed(2)}</td>
                  {receiving && (
                    <td className="px-5 py-4 text-center">
                      <input type="number" value={receivedQtys[item.id] || ''} onChange={(e) => setReceivedQtys({ ...receivedQtys, [item.id]: e.target.value })} min="0" max={item.quantity} className="w-20 h-10 px-3 bg-surface border-2 border-outline rounded-lg focus:border-primary focus:outline-none text-sm text-center" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receiving && (
        <div className="flex gap-3 mt-4">
          <button onClick={() => setReceiving(false)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold active:scale-95 transition-all">Cancel</button>
          <button onClick={() => receiveItems.mutate({ orderId: id, scope: order.storeId, items: Object.entries(receivedQtys).map(([itemId, qty]) => ({ itemId, receivedQty: parseInt(qty) || 0 })) })} className="flex-1 h-14 bg-success text-white font-bold rounded-[--radius-lg] active:scale-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">check</span>Confirm Receipt
          </button>
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-6 space-y-2 text-sm text-on-surface-secondary">
        <p>Created: {new Date(order.createdAt).toLocaleString()}</p>
        {order.orderedAt && <p>Ordered: {new Date(order.orderedAt).toLocaleString()}</p>}
        {order.receivedAt && <p>Received: {new Date(order.receivedAt).toLocaleString()}</p>}
      </div>
    </div>
  );
}
