'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ChecklistHistoryPage() {
  const router = useRouter();
  const { data: submissions, isLoading } = trpc.checklists.listSubmissions.useQuery();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push('/tools/closing-checklist'); }} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
        </button>
        <h2 className="text-2xl font-bold text-on-surface">Checklist History</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Past submissions</p>
      </section>

      <section className="px-5 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>
        ) : submissions && submissions.length > 0 ? (
          submissions.map((sub: any) => {
            const doneCount = sub.items.filter((i: any) => i.status === 'DONE').length;
            const total = sub.items.length;
            const isExpanded = expandedId === sub.id;
            return (
              <div key={sub.id} className="bg-surface-white rounded-[--radius-lg] shadow-[--shadow-card] overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : sub.id)} className="w-full p-4 flex items-center justify-between text-left">
                  <div>
                    <h3 className="font-bold text-on-surface">{sub.template.name}</h3>
                    <p className="text-sm text-on-surface-secondary mt-0.5">
                      {sub.submittedBy.fullName} · {new Date(sub.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface">{doneCount}/{total}</span>
                    <span className="material-symbols-outlined text-on-surface-secondary">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-outline/30 px-4 py-3 space-y-2">
                    {sub.items.map((item: any) => (
                      <div key={item.id} className={`flex items-start gap-3 py-1.5 ${item.status !== 'DONE' ? 'bg-warning/5 -mx-2 px-2 rounded-lg' : ''}`}>
                        <span className={`material-symbols-outlined text-[18px] mt-0.5 ${item.status === 'DONE' ? 'text-success' : 'text-warning'}`}>
                          {item.status === 'DONE' ? 'check_circle' : 'skip_next'}
                        </span>
                        <div>
                          <p className="text-sm text-on-surface">{item.label || item.templateItem?.label}</p>
                          {item.reason && <p className="text-xs text-on-surface-secondary italic mt-0.5">"{item.reason}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-on-surface-secondary">No submissions yet</div>
        )}
      </section>
    </div>
  );
}
