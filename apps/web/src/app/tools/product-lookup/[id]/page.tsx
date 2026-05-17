'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  if (!product) return null;

  const stockConfig: Record<string, { color: string; label: string; icon: string }> = {
    IN_STOCK: { color: 'text-success', label: 'In Stock', icon: 'check_circle' },
    LOW: { color: 'text-tertiary', label: 'Low Stock', icon: 'warning' },
    OUT_OF_STOCK: { color: 'text-error', label: 'Out of Stock', icon: 'cancel' },
  };

  const stock = stockConfig[product.stockStatus] || stockConfig.IN_STOCK;

  return (
    <div className="px-[--spacing-container] py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{product.name}</h2>
            {product.category && (
              <span className="text-sm text-on-surface-variant">{product.category.name}</span>
            )}
          </div>
          <div className={`flex items-center gap-1 ${stock.color}`}>
            <span className="material-symbols-outlined text-[18px]">{stock.icon}</span>
            <span className="text-xs font-bold">{stock.label}</span>
          </div>
        </div>

        {/* Retail price */}
        <div className="bg-primary/5 rounded-xl p-4 text-center mb-6">
          <p className="text-xs text-on-surface-variant">Retail Price</p>
          <p className="text-3xl font-black text-primary">${Number(product.retailPrice).toFixed(2)}</p>
        </div>

        {/* Details grid */}
        <div className="space-y-3">
          {product.barcode && (
            <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
              <span className="material-symbols-outlined text-on-surface-variant">barcode</span>
              <div>
                <p className="text-xs text-outline">Barcode</p>
                <p className="text-sm font-medium text-on-surface font-mono">{product.barcode}</p>
              </div>
            </div>
          )}
          {product.location && (
            <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
              <span className="material-symbols-outlined text-on-surface-variant">location_on</span>
              <div>
                <p className="text-xs text-outline">Location</p>
                <p className="text-sm font-medium text-on-surface">{product.location}</p>
              </div>
            </div>
          )}

          {/* Supervisor+ fields */}
          {product.costPrice !== null && (
            <>
              <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
                <span className="material-symbols-outlined text-on-surface-variant">payments</span>
                <div>
                  <p className="text-xs text-outline">Cost Price</p>
                  <p className="text-sm font-medium text-on-surface">${Number(product.costPrice).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
                <span className="material-symbols-outlined text-on-surface-variant">trending_up</span>
                <div>
                  <p className="text-xs text-outline">Markup</p>
                  <p className="text-sm font-medium text-on-surface">{Number(product.markupPercent).toFixed(1)}%</p>
                </div>
              </div>
            </>
          )}
          {product.supplier && (
            <div className="flex items-center gap-3 py-3">
              <span className="material-symbols-outlined text-on-surface-variant">local_shipping</span>
              <div>
                <p className="text-xs text-outline">Supplier</p>
                <p className="text-sm font-medium text-on-surface">{product.supplier}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
