'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { calculateMarkupPercent } from '@/lib/pricing';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: product } = trpc.products.getById.useQuery({ id });
  const { data: categories } = trpc.categories.list.useQuery();
  const [form, setForm] = useState({ name: '', brand: '', size: '', unit: '', barcode: '', sku: '', categoryId: '', costPrice: '', retailPrice: '', location: '', supplier: '', stockStatus: 'IN_STOCK' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (product && !loaded) {
      setForm({
        name: product.name,
        brand: (product as any).brand || '',
        size: (product as any).size || '',
        unit: (product as any).unit || '',
        barcode: product.barcode || '',
        sku: (product as any).sku || '',
        categoryId: product.categoryId || '',
        costPrice: product.costPrice ? String(Number(product.costPrice)) : '',
        retailPrice: String(Number(product.retailPrice)),
        location: product.location || '',
        supplier: product.supplier || '',
        stockStatus: product.stockStatus,
      });
      setLoaded(true);
    }
  }, [product, loaded]);

  const costNum = parseFloat(form.costPrice) || 0;
  const retailNum = parseFloat(form.retailPrice) || 0;
  const markupPercent = calculateMarkupPercent(costNum, retailNum);

  const update = trpc.products.update.useMutation({
    onSuccess: () => router.push('/admin/products'),
  });

  if (!product) return (
    <div className="flex items-center justify-center py-20">
      <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
    </div>
  );

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Products
      </button>

      <h1 className="text-3xl font-extrabold text-on-surface mb-8">Edit Product</h1>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm max-w-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-on-surface mb-2">Product Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Brand</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Size</label>
              <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Barcode</label>
            <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors">
              <option value="">No category</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Cost Price *</label>
            <input type="text" inputMode="decimal" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Retail Price *</label>
            <input type="text" inputMode="decimal" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Stock Status</label>
            <select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors">
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Supplier</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div className="flex items-end">
            <div className="bg-surface-cream rounded-[--radius-lg] p-4 w-full text-center">
              <p className="text-xs text-on-surface-secondary">Effective Markup</p>
              <p className="text-2xl font-bold text-on-surface">{markupPercent.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => update.mutate({
            id,
            name: form.name,
            brand: form.brand || null,
            size: form.size || null,
            unit: form.unit || null,
            barcode: form.barcode || null,
            sku: form.sku || null,
            categoryId: form.categoryId || null,
            costPrice: costNum,
            retailPrice: retailNum,
            markupPercent,
            location: form.location || null,
            supplier: form.supplier || null,
            stockStatus: form.stockStatus as any,
          })}
          disabled={!form.name.trim() || costNum <= 0 || retailNum <= 0 || update.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {update.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined">save</span>Save Changes</>}
        </button>
      </div>
    </div>
  );
}
