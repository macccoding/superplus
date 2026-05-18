'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function SubmissionsPage() {
  const router = useRouter();
  const { data: submissions } = trpc.checklists.listSubmissions.useQuery();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Checklists
      </button>

      <h1 className="text-3xl font-extrabold text-on-surface mb-2">Submission History</h1>
      <p className="text-on-surface-secondary mb-8">{submissions?.length || 0} submissions</p>

      <div className="space-y-3">
        {submissions?.map((sub: any) => {
          const doneCount = sub.items.filter((i: any) => i.status === 'DONE').length;
          const total = sub.items.length;
          const skipped = sub.items.filter((i: any) => i.status !== 'DONE');
          const isExpanded = expandedId === sub.id;

          return (
            <div key={sub.id} className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                className="w-full p-5 flex items-center justify-between text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-on-surface">{sub.template.name}</h3>
                    {skipped.length > 0 && (
                      <span className="text-xs bg-warning/20/30 text-warning px-2 py-0.5 rounded-full font-medium">
                        {skipped.length} skipped
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-secondary mt-1">
                    {sub.submittedBy.fullName} · {sub.completedAt.toLocaleDateString()} at {sub.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-on-surface">{doneCount}/{total}</span>
                  <span className="material-symbols-outlined text-on-surface-secondary">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-outline/20 px-5 py-4 space-y-2">
                  {sub.items.map((item: any) => (
                    <div key={item.id} className={`flex items-start gap-3 py-2 ${item.status !== 'DONE' ? 'bg-warning/20/10 -mx-2 px-2 rounded-lg' : ''}`}>
                      <span className={`material-symbols-outlined text-[18px] mt-0.5 ${
                        item.status === 'DONE' ? 'text-success' : item.status === 'SKIPPED' ? 'text-warning' : 'text-on-surface-secondary'
                      }`}>
                        {item.status === 'DONE' ? 'check_circle' : item.status === 'SKIPPED' ? 'skip_next' : 'remove_circle'}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm ${item.status === 'DONE' ? 'text-on-surface' : 'text-on-surface font-medium'}`}>
                          {item.templateItem.label}
                        </p>
                        {item.reason && (
                          <p className="text-xs text-on-surface-secondary italic mt-0.5">"{item.reason}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {(!submissions || submissions.length === 0) && (
          <div className="text-center py-12 text-on-surface-secondary">
            <span className="material-symbols-outlined text-[48px] text-on-surface-secondary mb-3">history</span>
            <p>No submissions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
