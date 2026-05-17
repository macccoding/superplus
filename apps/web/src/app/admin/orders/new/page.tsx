'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function NewOrderPage() {
  const router = useRouter();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ productName: '', quantity: '', unitCost: '' }]);
  const [notes, setNotes] = useState('');

  const create = trpc.orders.create.useMutation({
    onSuccess: () => router.push('/admin/orders'),
  });

  const total = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 0) * (parseFloat(i.unitCost) || 0), 0);

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Orders
      </button>

      <h1 className="text-3xl font-black text-on-surface mb-8">New Purchase Order</h1>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm max-w-2xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Supplier *</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface">
            <option value="">Select supplier...</option>
            {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Line Items</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input value={item.productName} onChange={(e) => { const copy = [...items]; copy[i].productName = e.target.value; setItems(copy); }} placeholder="Product name" className="flex-1 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-outline" />
                <input value={item.quantity} onChange={(e) => { const copy = [...items]; copy[i].quantity = e.target.value; setItems(copy); }} placeholder="Qty" type="number" className="w-20 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface text-center" />
                <input value={item.unitCost} onChange={(e) => { const copy = [...items]; copy[i].unitCost = e.target.value; setItems(copy); }} placeholder="Cost" type="number" className="w-24 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface text-center" />
                {items.length > 1 && <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="w-12 h-12 flex items-center justify-center text-error"><span className="material-symbols-outlined text-[20px]">close</span></button>}
              </div>
            ))}
            <button onClick={() => setItems([...items, { productName: '', quantity: '', unitCost: '' }])} className="w-full h-10 border-2 border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant font-medium flex items-center justify-center gap-1 hover:border-primary transition-colors">
              <span className="material-symbols-outlined text-[16px]">add</span>Add Item
            </button>
          </div>
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline resize-none" />

        <div className="bg-surface-container-high rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">Estimated Total</span>
          <span className="text-2xl font-bold text-on-surface">${total.toFixed(2)}</span>
        </div>

        <button
          onClick={() => create.mutate({ supplierId, items: items.filter(i => i.productName).map(i => ({ productName: i.productName, quantity: parseInt(i.quantity) || 1, unitCost: parseFloat(i.unitCost) || 0 })), notes: notes || undefined })}
          disabled={!supplierId || !items.some(i => i.productName) || create.isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
        >
          {create.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Creating...</> : <><span className="material-symbols-outlined">receipt_long</span>Create Purchase Order</>}
        </button>
      </div>
    </div>
  );
}
