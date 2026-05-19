'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>}>
      <SubmissionsContent />
    </Suspense>
  );
}

function SubmissionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialScope = searchParams.get('scope') || 'ALL';
  const initialTemplate = searchParams.get('templateId') || 'ALL';
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState(initialScope);
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [status, setStatus] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: templates } = trpc.checklists.listTemplates.useQuery({ scope: activeScope });
  const { data: submissions, isLoading } = trpc.checklists.listSubmissions.useQuery({
    scope: activeScope,
    templateId: templateId === 'ALL' ? undefined : templateId,
    status: status === 'ALL' ? undefined : status as any,
  });

  const templateOptions = useMemo(() => templates ?? [], [templates]);

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="h-11 px-3 inline-flex items-center gap-1 text-sm font-bold text-on-surface-secondary rounded-[--radius-md] bg-surface-white">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Checklists
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Submission History</h1>
          <p className="text-on-surface-secondary mt-1">{submissions?.length || 0} submissions in scope</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Template filter">
            <option value="ALL">All Templates</option>
            {templateOptions.map((template: any) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Submission status">
            <option value="ALL">All Results</option>
            <option value="COMPLETE">Complete</option>
            <option value="ISSUES">Issues</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions?.map((sub: any) => {
            const doneCount = sub.items.filter((i: any) => i.status === 'DONE').length;
            const total = sub.items.length;
            const skipped = sub.items.filter((i: any) => i.status !== 'DONE');
            const isExpanded = expandedId === sub.id;

            return (
              <div key={sub.id} className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : sub.id)} className="w-full p-5 flex items-center justify-between gap-4 text-left min-h-[72px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-on-surface">{sub.template.name}</h3>
                      {skipped.length > 0 && <span className="text-xs bg-warning/15 text-warning px-2 py-1 rounded-full font-bold">{skipped.length} issue(s)</span>}
                      <span className="text-xs bg-surface-cream text-on-surface-secondary px-2 py-1 rounded-full font-bold">{sub.store?.name}</span>
                    </div>
                    <p className="text-sm text-on-surface-secondary mt-1">
                      {sub.submittedBy.fullName} · {new Date(sub.completedAt).toLocaleDateString()} at {new Date(sub.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-on-surface">{doneCount}/{total}</span>
                    <span className="material-symbols-outlined text-on-surface-secondary">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-outline/20 px-5 py-4 space-y-2">
                    {sub.items.map((item: any) => (
                      <div key={item.id} className={`flex items-start gap-3 py-3 ${item.status !== 'DONE' ? 'bg-warning/10 -mx-2 px-2 rounded-[--radius-md]' : ''}`}>
                        <span className={`material-symbols-outlined text-[20px] mt-0.5 ${item.status === 'DONE' ? 'text-success' : item.status === 'SKIPPED' ? 'text-warning' : 'text-on-surface-secondary'}`}>
                          {item.status === 'DONE' ? 'check_circle' : item.status === 'SKIPPED' ? 'skip_next' : 'remove_circle'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-on-surface">{item.templateItem?.label || item.label || 'Checklist item'}</p>
                          {item.reason && <p className="text-xs text-on-surface-secondary italic mt-1">"{item.reason}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {submissions?.length === 0 && (
            <div className="text-center py-12 text-on-surface-secondary bg-surface-white rounded-[--radius-lg] shadow-sm">
              <span className="material-symbols-outlined text-[48px] mb-3">history</span>
              <p className="font-bold text-on-surface">No submissions match these filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
