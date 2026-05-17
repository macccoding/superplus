'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function SuppliersPage() {
  const utils = trpc.useUtils();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', notes: '' });

  const create = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); setShowAdd(false); setForm({ name: '', contact: '', phone: '', email: '', notes: '' }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Suppliers</h1>
          <p className="text-on-surface-variant mt-1">{suppliers?.length || 0} suppliers</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-md">
          <span className="material-symbols-outlined text-[20px]">add</span>Add Supplier
        </button>
      </div>

      <div className="space-y-3">
        {suppliers?.map((s: any) => (
          <div key={s.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-lg">{s.name}</h3>
                  {s.contact && <p className="text-sm text-on-surface-variant">{s.contact}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {s.phone && <span className="text-xs text-outline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span>{s.phone}</span>}
                    {s.email && <span className="text-xs text-outline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">mail</span>{s.email}</span>}
                  </div>
                </div>
              </div>
              <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">{s._count.orders} orders</span>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">Add Supplier</h2>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name *" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Contact person" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" type="tel" className="h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline resize-none" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all">Cancel</button>
              <button onClick={() => create.mutate({ name: form.name, contact: form.contact || undefined, phone: form.phone || undefined, email: form.email || undefined, notes: form.notes || undefined })} disabled={!form.name.trim()} className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all shadow-md">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
