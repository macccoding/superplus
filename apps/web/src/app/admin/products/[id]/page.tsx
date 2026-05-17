'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: product } = trpc.products.getById.useQuery({ id });
  const { data: categories } = trpc.categories.list.useQuery();
  const [form, setForm] = useState({ name: '', barcode: '', sku: '', categoryId: '', costPrice: '', retailPrice: '', location: '', supplier: '', stockStatus: 'IN_STOCK' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (product && !loaded) {
      setForm({
        name: product.name,
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
  const markupPercent = costNum > 0 ? ((retailNum - costNum) / costNum) * 100 : 0;

  const update = trpc.products.update.useMutation({
    onSuccess: () => router.push('/admin/products'),
  });

  if (!product) return (
    <div className="flex items-center justify-center py-20">
      <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
    </div>
  );

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Products
      </button>

      <h1 className="text-3xl font-black text-on-surface mb-8">Edit Product</h1>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm max-w-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-on-surface mb-2">Product Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Barcode</label>
            <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors">
              <option value="">No category</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Cost Price *</label>
            <input type="text" inputMode="decimal" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Retail Price *</label>
            <input type="text" inputMode="decimal" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value.replace(/[^0-9.]/g, '') })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Stock Status</label>
            <select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors">
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Supplier</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
          </div>
          <div className="flex items-end">
            <div className="bg-surface-container-high rounded-xl p-4 w-full text-center">
              <p className="text-xs text-on-surface-variant">Effective Markup</p>
              <p className="text-2xl font-bold text-on-surface">{markupPercent.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => update.mutate({
            id,
            name: form.name,
            barcode: form.barcode || null,
            categoryId: form.categoryId || null,
            costPrice: costNum,
            retailPrice: retailNum,
            markupPercent,
            location: form.location || null,
            supplier: form.supplier || null,
            stockStatus: form.stockStatus as any,
          })}
          disabled={!form.name.trim() || costNum <= 0 || retailNum <= 0 || update.isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {update.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined">save</span>Save Changes</>}
        </button>
      </div>
    </div>
  );
}
