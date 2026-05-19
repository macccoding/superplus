'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function SuppliersPage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: suppliers } = trpc.suppliers.list.useQuery({ scope: activeScope });
  const { data: supply } = trpc.admin.supplyOverview.useQuery({ scope: activeScope, days: 30 });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', notes: '', storeId: '' });

  const create = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); utils.admin.invalidate(); setShowAdd(false); setForm({ name: '', contact: '', phone: '', email: '', notes: '', storeId: '' }); },
  });
  const reliability = new Map<string, any>((supply?.suppliers ?? []).map((supplier: any) => [supplier.id, supplier]));
  const selectedStore = activeScope === 'ALL' ? form.storeId : activeScope;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Suppliers</h1>
          <p className="text-on-surface-secondary mt-1">{suppliers?.length || 0} suppliers</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)} className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
            <span className="material-symbols-outlined text-[20px]">add</span>Add Supplier
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {suppliers?.map((s: any) => {
          const r = reliability.get(s.id);
          return (
          <div key={s.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[--radius-lg] bg-tertiary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-warning" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-lg">{s.name}</h3>
                  {s.contact && <p className="text-sm text-on-surface-secondary">{s.contact}</p>}
                  <p className="text-xs text-on-surface-secondary mt-1">{s.store?.name || r?.store?.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {s.phone && <span className="text-xs text-on-surface-secondary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span>{s.phone}</span>}
                    {s.email && <span className="text-xs text-on-surface-secondary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">mail</span>{s.email}</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Orders" value={r?.orderCount ?? s._count.orders} />
                <Mini label="Partial" value={r?.partialOrders ?? 0} warning />
                <Mini label="Open" value={r?.openOrders ?? 0} />
              </div>
            </div>
          </div>
        );})}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Supplier</h2>
            {activeScope === 'ALL' && (
              <select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface">
                <option value="">Choose store</option>
                {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            )}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name *" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Contact person" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" type="tel" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold active:scale-95 transition-all">Cancel</button>
              <button onClick={() => create.mutate({ scope: selectedStore, name: form.name, contact: form.contact || undefined, phone: form.phone || undefined, email: form.email || undefined, notes: form.notes || undefined })} disabled={!form.name.trim() || !selectedStore} className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all shadow-md">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={warning && value > 0 ? 'text-warning' : 'text-on-surface-secondary'}>
      <p className="text-sm font-extrabold">{value}</p>
      <p className="text-[10px] font-bold uppercase">{label}</p>
    </div>
  );
}
