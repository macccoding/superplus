'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const labels: Record<string, { title: string; icon: string; tone: string }> = {
  missingBarcodeOrSku: { title: 'Missing Barcode/SKU', icon: 'barcode', tone: 'text-error' },
  duplicateLookingNames: { title: 'Duplicate-Looking Names', icon: 'content_copy', tone: 'text-warning' },
  zeroCost: { title: 'Zero Cost', icon: 'payments', tone: 'text-error' },
  zeroRetail: { title: 'Zero Retail', icon: 'sell', tone: 'text-error' },
  missingCategory: { title: 'Missing Category', icon: 'category', tone: 'text-warning' },
  missingLocation: { title: 'Missing Location', icon: 'location_off', tone: 'text-warning' },
  staleImport: { title: 'Stale/Missing Import', icon: 'schedule', tone: 'text-on-surface-secondary' },
  lowMargin: { title: 'Low Margin', icon: 'trending_down', tone: 'text-warning' },
};

export default function ProductQaPage() {
  const router = useRouter();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data, isLoading } = trpc.products.qa.useQuery({ scope: activeScope });

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Products
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Product QA</h1>
          <p className="text-on-surface-secondary mt-1">{data?.totalProducts ?? 0} products audited</p>
        </div>
        <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
          {canUseAllStores && <option value="ALL">All Stores</option>}
          {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Object.entries(labels).map(([key, meta]) => (
              <div key={key} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={`material-symbols-outlined ${meta.tone}`}>{meta.icon}</span>
                  <p className="text-2xl font-extrabold text-on-surface">{(data?.summary as any)?.[key] ?? 0}</p>
                </div>
                <p className="text-xs font-bold text-on-surface-secondary mt-2">{meta.title}</p>
              </div>
            ))}
          </div>

          {Object.entries(labels).map(([key, meta]) => {
            const items = (data?.findings as any)?.[key] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={key} className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-outline/20 flex items-center gap-2">
                  <span className={`material-symbols-outlined ${meta.tone}`}>{meta.icon}</span>
                  <h2 className="font-bold text-on-surface">{meta.title}</h2>
                </div>
                <div className="divide-y divide-outline/10">
                  {items.slice(0, 10).map((product: any) => (
                    <button key={`${key}-${product.id}`} onClick={() => router.push(`/admin/products/${product.id}`)} className="w-full p-4 text-left active:bg-surface transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-on-surface">{product.name}</p>
                          <p className="text-xs text-on-surface-secondary mt-0.5">
                            {[product.store?.name, product.category?.name, product.location || 'No location'].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-secondary">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {data && Object.values(data.summary as Record<string, number>).every((count) => count === 0) && (
            <div className="bg-success/10 rounded-[--radius-lg] p-8 text-center">
              <span className="material-symbols-outlined text-success text-[48px]">verified</span>
              <h2 className="text-xl font-bold text-success mt-2">Catalog Looks Clean</h2>
              <p className="text-sm text-on-surface-secondary mt-1">No V1 product quality issues found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
