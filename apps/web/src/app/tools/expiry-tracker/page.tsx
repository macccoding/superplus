'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useSession } from 'next-auth/react';
import { EmptyState } from '@superplus/ui';

export default function ExpiryTrackerPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: alerts, isLoading } = trpc.expiryAlerts.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  const [mutationError, setMutationError] = useState('');

  const canManage = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';

  const create = trpc.expiryAlerts.create.useMutation({
    onSuccess: () => { utils.expiryAlerts.invalidate(); setShowForm(false); setProductName(''); setSelectedProduct(null); setExpiryDate(''); setQuantity('1'); setLocation(''); },
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });
  const { data: productResults } = trpc.products.search.useQuery(
    { query: productName || undefined, limit: 5 },
    { enabled: showForm && productName.trim().length >= 2 && !selectedProduct }
  );

  const updateStatus = trpc.expiryAlerts.updateStatus.useMutation({
    onSuccess: () => utils.expiryAlerts.invalidate(),
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });
  const createTask = trpc.tasks.createFromSource.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });

  function getUrgency(dateStr: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    // Parse as UTC date (Prisma @db.Date returns midnight UTC)
    const parts = new Date(dateStr).toISOString().slice(0, 10).split('-').map(Number);
    const expiry = new Date(parts[0], parts[1] - 1, parts[2]);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Expired', color: 'bg-error text-on-error', border: 'border-l-error', days: diff };
    if (diff === 0) return { label: 'Today', color: 'bg-error text-on-error animate-pulse', border: 'border-l-error', days: 0 };
    if (diff <= 3) return { label: `${diff}d`, color: 'bg-warning/20 text-warning', border: 'border-l-tertiary-container', days: diff };
    if (diff <= 7) return { label: `${diff}d`, color: 'bg-warning/20/50 text-warning', border: 'border-l-tertiary-container', days: diff };
    return { label: `${diff}d`, color: 'bg-surface-cream text-on-surface-secondary', border: 'border-l-outline-variant', days: diff };
  }

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Expiry Tracker</h2>
        <p className="text-sm text-on-surface-secondary mt-1">{alerts?.length || 0} active alerts</p>
      </section>

      {mutationError && (
        <div className="mx-[--spacing-container] mb-4 bg-error/10 text-error rounded-[--radius-lg] p-3 flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {mutationError}
        </div>
      )}

      <section className="px-5 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert: any) => {
            const urgency = getUrgency(alert.expiryDate);
            return (
              <div key={alert.id} className={`bg-surface-white rounded-[--radius-lg] p-4 shadow-sm border-l-4 ${urgency.border}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-on-surface">{alert.productName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgency.color}`}>{urgency.label}</span>
                      <span className="text-xs text-on-surface-secondary">Qty: {alert.quantity}</span>
                      {alert.location && <span className="text-xs text-on-surface-secondary">{alert.location}</span>}
                    </div>
                    <p className="text-xs text-on-surface-secondary mt-1">Reported by {alert.reportedBy.fullName}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => createTask.mutate({
                          sourceType: 'EXPIRY_ALERT' as any,
                          sourceId: alert.id,
                          sourceLabel: alert.productName,
                          title: `${urgency.days <= 0 ? 'Pull' : 'Check'} ${alert.productName}`,
                          description: `${alert.quantity} item(s) expiring ${urgency.label}${alert.location ? ` at ${alert.location}` : ''}.`,
                          category: 'Expiry',
                          workArea: alert.location || undefined,
                          priority: urgency.days <= 0 ? 'URGENT' as any : urgency.days <= 3 ? 'HIGH' as any : 'NORMAL' as any,
                          reviewRequired: urgency.days <= 0,
                        })}
                        className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center"
                        title="Create task"
                      >
                        <span className="material-symbols-outlined text-[20px] text-navy">add_task</span>
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: alert.id, status: 'PULLED' })}
                        className="w-12 h-12 bg-warning/20/30 rounded-lg flex items-center justify-center"
                        title="Mark as Pulled"
                      >
                        <span className="material-symbols-outlined text-[20px] text-warning">remove_shopping_cart</span>
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: alert.id, status: 'RESOLVED' })}
                        className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center"
                        title="Resolve"
                      >
                        <span className="material-symbols-outlined text-[20px] text-success">check</span>
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
          <div className="bg-surface-white w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-xl font-bold text-on-surface">Report Expiry</h3>
            <input
              value={productName}
              onChange={(e) => { setProductName(e.target.value); setSelectedProduct(null); }}
              placeholder="Search product or enter manually"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
              autoFocus
            />
            {!selectedProduct && productResults && productResults.items.length > 0 && (
              <div className="rounded-[--radius-lg] bg-surface overflow-hidden">
                {productResults.items.map((product: any) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductName(product.name);
                      setLocation(product.location || location);
                    }}
                    className="w-full p-3 text-left border-b border-outline/10 last:border-b-0 active:bg-surface-cream"
                  >
                    <p className="text-sm font-bold text-on-surface">{product.name}</p>
                    <p className="text-xs text-on-surface-secondary">{[product.brand, product.location, product.matchReason].filter(Boolean).join(' · ') || 'Catalog product'}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="rounded-[--radius-lg] bg-success/10 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-success">Linked to catalog</p>
                  <p className="text-xs text-on-surface-secondary">{selectedProduct.barcode || selectedProduct.sku || selectedProduct.category?.name || selectedProduct.name}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 rounded-lg bg-surface-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-secondary mb-1">Expiry Date</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-secondary mb-1">Quantity</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
              </div>
            </div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Aisle 3)" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            <button
              onClick={() => {
                const [y, m, d] = expiryDate.split('-').map(Number);
                const parsedDate = new Date(y, m - 1, d);
                create.mutate({ productName, productId: selectedProduct?.id, expiryDate: parsedDate, quantity: parseInt(quantity) || 1, location: location || undefined });
              }}
              disabled={!productName.trim() || !expiryDate || create.isPending}
              className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
            >
              Report
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(true)} className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-warning/20 text-warning shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
