'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { calculateMarkupPercent } from '@/lib/pricing';

export default function NewProductPage() {
  const router = useRouter();
  const { data: categories } = trpc.categories.list.useQuery();
  const [form, setForm] = useState({
    name: '', brand: '', size: '', unit: '', barcode: '', sku: '', categoryId: '', costPrice: '', retailPrice: '', location: '', supplier: '',
  });

  const selectedCategory = categories?.find(c => c.id === form.categoryId);
  const costNum = parseFloat(form.costPrice) || 0;
  const retailNum = parseFloat(form.retailPrice) || 0;
  const markupPercent = calculateMarkupPercent(costNum, retailNum);

  function handleCostChange(value: string) {
    const cost = parseFloat(value) || 0;
    const newForm = { ...form, costPrice: value };
    if (selectedCategory && cost > 0) {
      const retail = cost * (1 + Number(selectedCategory.defaultMarkupPercent) / 100);
      newForm.retailPrice = retail.toFixed(2);
    }
    setForm(newForm);
  }

  const create = trpc.products.create.useMutation({
    onSuccess: () => router.push('/admin/products'),
  });

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Products
      </button>

      <h1 className="text-3xl font-extrabold text-on-surface mb-8">Add Product</h1>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm max-w-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-on-surface mb-2">Product Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grace Corned Beef 340g" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Brand</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Grace" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Size</label>
              <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="340" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="g" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Barcode</label>
            <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="UPC/EAN" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Internal SKU" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors">
              <option value="">No category</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name} ({Number(c.defaultMarkupPercent)}%)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Aisle 2, Shelf B" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Cost Price (JMD) *</label>
            <input type="text" inputMode="decimal" value={form.costPrice} onChange={(e) => handleCostChange(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Retail Price (JMD) *</label>
            <input type="text" inputMode="decimal" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="0.00" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Supplier</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          </div>
          <div className="flex items-end">
            <div className="bg-surface-cream rounded-[--radius-lg] p-4 w-full text-center">
              <p className="text-xs text-on-surface-secondary">Effective Markup</p>
              <p className="text-2xl font-bold text-on-surface">{markupPercent.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => create.mutate({
            name: form.name,
            brand: form.brand || undefined,
            size: form.size || undefined,
            unit: form.unit || undefined,
            barcode: form.barcode || undefined,
            sku: form.sku || undefined,
            categoryId: form.categoryId || undefined,
            costPrice: costNum,
            retailPrice: retailNum,
            markupPercent,
            location: form.location || undefined,
            supplier: form.supplier || undefined,
          })}
          disabled={!form.name.trim() || costNum <= 0 || retailNum <= 0 || create.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {create.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined">add</span>Add Product</>}
        </button>
      </div>
    </div>
  );
}
