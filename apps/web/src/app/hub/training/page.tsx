'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function TrainingPage() {
  const router = useRouter();
  const { data: guides, isLoading } = trpc.training.listGuides.useQuery();

  // Group by category
  const grouped = new Map<string, any[]>();
  guides?.forEach((g: any) => {
    if (!grouped.has(g.category)) grouped.set(g.category, []);
    grouped.get(g.category)!.push(g);
  });

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Training</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step-by-step guides</p>
      </section>

      <section className="px-[--spacing-container] pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>
        ) : guides && guides.length > 0 ? (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-3">{category}</h3>
                <div className="space-y-2">
                  {items.map((g: any) => (
                    <button key={g.id} onClick={() => router.push(`/hub/training/${g.id}`)} className="w-full text-left bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all">
                      <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-on-surface truncate">{g.title}</h4>
                        {g.description && <p className="text-xs text-on-surface-variant mt-0.5 truncate">{g.description}</p>}
                        <p className="text-xs text-outline mt-1">{g._count.steps} steps</p>
                      </div>
                      <span className="material-symbols-outlined text-outline">chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="school" title="No guides yet" description="Training guides will appear here when published" />
        )}
      </section>
    </div>
  );
}
