'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useSession } from 'next-auth/react';
import { EmptyState } from '@superplus/ui';

export default function ExpiryTrackerPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: alerts } = trpc.expiryAlerts.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');

  const canManage = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';

  const create = trpc.expiryAlerts.create.useMutation({
    onSuccess: () => { utils.expiryAlerts.invalidate(); setShowForm(false); setProductName(''); setExpiryDate(''); setQuantity('1'); setLocation(''); },
  });

  const updateStatus = trpc.expiryAlerts.updateStatus.useMutation({
    onSuccess: () => utils.expiryAlerts.invalidate(),
  });

  function getUrgency(dateStr: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(dateStr); expiry.setHours(0,0,0,0);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Expired', color: 'bg-error text-on-error', border: 'border-l-error', days: diff };
    if (diff === 0) return { label: 'Today', color: 'bg-error text-on-error animate-pulse', border: 'border-l-error', days: 0 };
    if (diff <= 3) return { label: `${diff}d`, color: 'bg-tertiary-container text-on-tertiary-container', border: 'border-l-tertiary-container', days: diff };
    if (diff <= 7) return { label: `${diff}d`, color: 'bg-tertiary-container/50 text-on-tertiary-container', border: 'border-l-tertiary-container', days: diff };
    return { label: `${diff}d`, color: 'bg-surface-container-high text-on-surface-variant', border: 'border-l-outline-variant', days: diff };
  }

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Expiry Tracker</h2>
        <p className="text-sm text-on-surface-variant mt-1">{alerts?.length || 0} active alerts</p>
      </section>

      <section className="px-[--spacing-container] pb-24 space-y-3">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert: any) => {
            const urgency = getUrgency(alert.expiryDate);
            return (
              <div key={alert.id} className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm border-l-4 ${urgency.border}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-on-surface">{alert.productName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgency.color}`}>{urgency.label}</span>
                      <span className="text-xs text-on-surface-variant">Qty: {alert.quantity}</span>
                      {alert.location && <span className="text-xs text-outline">{alert.location}</span>}
                    </div>
                    <p className="text-xs text-outline mt-1">Reported by {alert.reportedBy.fullName}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateStatus.mutate({ id: alert.id, status: 'PULLED' })}
                        className="w-9 h-9 bg-tertiary-container/30 rounded-lg flex items-center justify-center"
                        title="Mark as Pulled"
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">remove_shopping_cart</span>
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: alert.id, status: 'RESOLVED' })}
                        className="w-9 h-9 bg-success/10 rounded-lg flex items-center justify-center"
                        title="Resolve"
                      >
                        <span className="material-symbols-outlined text-[18px] text-success">check</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState icon="event_available" title="No expiry alerts" description="All clear — no items expiring soon" />
        )}
      </section>

      {/* Add form bottom sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-lowest w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-xl font-bold text-on-surface">Report Expiry</h3>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product name" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Expiry Date</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Quantity</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
              </div>
            </div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Aisle 3)" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors" />
            <button
              onClick={() => create.mutate({ productName, expiryDate: new Date(expiryDate + 'T00:00:00'), quantity: parseInt(quantity) || 1, location: location || undefined })}
              disabled={!productName.trim() || !expiryDate || create.isPending}
              className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
            >
              Report
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(true)} className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-tertiary-container text-on-tertiary-container shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
