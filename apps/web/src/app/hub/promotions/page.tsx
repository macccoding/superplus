'use client';

import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function PromotionsPage() {
  const { data: promotions, isLoading } = trpc.promotions.active.useQuery();

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Deals</h2>
        <p className="text-sm text-on-surface-variant mt-1">Current promotions</p>
      </section>

      <section className="px-[--spacing-container] pb-24 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>
        ) : promotions && promotions.length > 0 ? (
          promotions.map((promo: any) => (
            <div key={promo.id} className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-5 py-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-on-surface">{promo.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{promo.type.replaceAll('_', ' ')} · Until {new Date(promo.endDate).toLocaleDateString()}</p>
                </div>
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>sell</span>
              </div>
              {promo.description && <p className="px-5 py-2 text-sm text-on-surface-variant">{promo.description}</p>}
              <div className="divide-y divide-outline-variant/10">
                {promo.items.map((item: any) => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-on-surface font-medium">{item.productName}</span>
                    <div className="text-right">
                      <span className="text-xs text-outline line-through">${Number(item.originalPrice).toFixed(2)}</span>
                      <span className="text-sm font-bold text-primary ml-2">${Number(item.promoPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon="sell" title="No active deals" description="Check back later for promotions" />
        )}
      </section>
    </div>
  );
}
