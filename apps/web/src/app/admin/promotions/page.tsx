'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

const typeLabels: Record<string, string> = { WEEKLY_SPECIAL: 'Weekly Special', CLEARANCE: 'Clearance', SEASONAL: 'Seasonal', BUNDLE: 'Bundle', OTHER: 'Other' };
const types = ['WEEKLY_SPECIAL', 'CLEARANCE', 'SEASONAL', 'BUNDLE', 'OTHER'] as const;

export default function AdminPromotionsPage() {
  const utils = trpc.useUtils();
  const { data: promotions } = trpc.promotions.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'WEEKLY_SPECIAL' as string, startDate: '', endDate: '', items: [{ productName: '', originalPrice: '', promoPrice: '' }] });

  const create = trpc.promotions.create.useMutation({
    onSuccess: () => { utils.promotions.invalidate(); setShowCreate(false); setForm({ title: '', description: '', type: 'WEEKLY_SPECIAL', startDate: '', endDate: '', items: [{ productName: '', originalPrice: '', promoPrice: '' }] }); },
  });
  const toggle = trpc.promotions.toggleActive.useMutation({ onSuccess: () => utils.promotions.invalidate() });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Promotions</h1>
          <p className="text-on-surface-variant mt-1">Manage store deals</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-md">
          <span className="material-symbols-outlined text-[20px]">add</span>New Promotion
        </button>
      </div>

      <div className="space-y-3">
        {promotions?.map((p: any) => (
          <div key={p.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-on-surface text-lg">{p.title}</h3>
                <p className="text-sm text-on-surface-variant">{typeLabels[p.type]} · {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}</p>
                <p className="text-xs text-outline mt-1">{p._count?.items || p.items?.length || 0} items</p>
              </div>
              <button onClick={() => toggle.mutate({ id: p.id })} className={`px-3 py-1.5 rounded-full text-xs font-bold ${p.isActive ? 'bg-success/10 text-success' : 'bg-outline/10 text-outline'}`}>
                {p.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-lg space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">New Promotion</h2>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Promotion title" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface">
                {types.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
              </select>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface" />
            </div>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} placeholder="End date" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface" />

            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface">Items</label>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input value={item.productName} onChange={(e) => { const items = [...form.items]; items[i].productName = e.target.value; setForm({ ...form, items }); }} placeholder="Product" className="flex-1 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface" />
                  <input value={item.originalPrice} onChange={(e) => { const items = [...form.items]; items[i].originalPrice = e.target.value; setForm({ ...form, items }); }} placeholder="Was" type="number" className="w-20 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface" />
                  <input value={item.promoPrice} onChange={(e) => { const items = [...form.items]; items[i].promoPrice = e.target.value; setForm({ ...form, items }); }} placeholder="Now" type="number" className="w-20 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface" />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, items: [...form.items, { productName: '', originalPrice: '', promoPrice: '' }] })} className="w-full h-10 border-2 border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant font-medium flex items-center justify-center gap-1 hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>Add Item
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all">Cancel</button>
              <button onClick={() => create.mutate({ title: form.title, type: form.type as any, startDate: new Date(form.startDate), endDate: new Date(form.endDate), description: form.description || undefined, items: form.items.filter(i => i.productName).map(i => ({ productName: i.productName, originalPrice: parseFloat(i.originalPrice) || 0, promoPrice: parseFloat(i.promoPrice) || 0 })) })} disabled={!form.title || !form.startDate || !form.endDate || !form.items.some(i => i.productName)} className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all shadow-md">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
