'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ProductsAdminPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = trpc.products.search.useQuery({ query: debouncedSearch || undefined, limit: 200 });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Products</h1>
          <p className="text-on-surface-secondary mt-1">{data?.items.length ?? 0} products</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/products/import')}
            className="h-12 px-5 bg-surface-cream text-on-surface-secondary font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Import CSV
          </button>
          <button
            onClick={() => router.push('/admin/products/new')}
            className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-secondary">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full h-12 pl-12 pr-4 bg-surface-white border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-outline/30">
                <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Product</th>
                <th className="text-left px-5 py-4 text-sm font-medium text-on-surface-secondary">Category</th>
                <th className="text-right px-5 py-4 text-sm font-medium text-on-surface-secondary">Cost</th>
                <th className="text-right px-5 py-4 text-sm font-medium text-on-surface-secondary">Retail</th>
                <th className="text-right px-5 py-4 text-sm font-medium text-on-surface-secondary">Margin</th>
                <th className="text-center px-5 py-4 text-sm font-medium text-on-surface-secondary">Stock</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((product: any) => (
                <tr
                  key={product.id}
                  onClick={() => router.push(`/admin/products/${product.id}`)}
                  className="border-b border-outline/10 hover:bg-surface transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-on-surface">{product.name}</p>
                    {product.barcode && <p className="text-xs text-on-surface-secondary font-mono mt-0.5">{product.barcode}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-secondary">{product.category?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-secondary text-right">${Number(product.costPrice).toFixed(2)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-on-surface text-right">${Number(product.retailPrice).toFixed(2)}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-secondary text-right">{Number(product.markupPercent).toFixed(0)}%</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                      product.stockStatus === 'IN_STOCK' ? 'bg-success' :
                      product.stockStatus === 'LOW' ? 'bg-warning/20' : 'bg-error'
                    }`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {!isLoading && data?.items.length === 0 && (
          <div className="py-12 text-center text-on-surface-secondary text-sm">No products found</div>
        )}
      </div>
    </div>
  );
}
