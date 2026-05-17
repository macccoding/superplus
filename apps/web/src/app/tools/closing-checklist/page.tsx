'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';

type ItemState = { templateItemId: string; status: 'DONE' | 'SKIPPED' | 'NOT_APPLICABLE' | null; reason: string };

export default function ClosingChecklistPage() {
  const { data: session } = useSession();
  const canSubmit = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';
  const { data: templates, isLoading: templatesLoading } = trpc.checklists.listTemplates.useQuery();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [reasonModal, setReasonModal] = useState<{ index: number; status: 'SKIPPED' | 'NOT_APPLICABLE' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const utils = trpc.useUtils();

  // Auto-select if only one template
  useEffect(() => {
    if (templates?.length === 1 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const { data: template, isLoading: templateLoading } = trpc.checklists.getTemplate.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId }
  );

  const { data: todayStatus } = trpc.checklists.todayStatus.useQuery(
    { templateId: selectedTemplateId! },
    { enabled: !!selectedTemplateId }
  );

  // Initialize items when template loads
  useEffect(() => {
    if (template) {
      setItems(template.items.map(item => ({ templateItemId: item.id, status: null, reason: '' })));
    }
  }, [template]);

  const submit = trpc.checklists.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      utils.checklists.invalidate();
    },
  });

  const allAddressed = items.length > 0 && items.every(i => i.status !== null);
  const doneCount = items.filter(i => i.status === 'DONE').length;

  function setItemStatus(index: number, status: 'DONE' | 'SKIPPED' | 'NOT_APPLICABLE') {
    if (status === 'DONE') {
      setItems(prev => prev.map((item, i) => i === index ? { ...item, status: 'DONE', reason: '' } : item));
    } else {
      setReasonModal({ index, status });
      setReasonText('');
    }
  }

  function confirmReason() {
    if (!reasonModal || !reasonText.trim()) return;
    setItems(prev => prev.map((item, i) => i === reasonModal.index ? { ...item, status: reasonModal.status, reason: reasonText.trim() } : item));
    setReasonModal(null);
    setReasonText('');
  }

  // Loading state
  if (templatesLoading) {
    return (
      <div className="px-[--spacing-container] py-6">
        <section className="px-0 pt-0 pb-4">
          <h2 className="text-2xl font-bold text-on-surface">Closing Checklist</h2>
        </section>
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
        </div>
      </div>
    );
  }

  // STAFF read-only view
  if (!canSubmit) {
    return (
      <div className="px-[--spacing-container] py-6">
        <section className="px-0 pt-0 pb-4">
          <h2 className="text-2xl font-bold text-on-surface">Closing Checklist</h2>
        </section>
        <div className="bg-surface-container-low rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-outline text-[48px] mb-2">lock</span>
          <h3 className="text-lg font-bold text-on-surface">Supervisors Only</h3>
          <p className="text-sm text-on-surface-variant mt-2">Only supervisors can submit checklists.</p>
        </div>
      </div>
    );
  }

  // Already submitted today
  if (todayStatus) {
    return (
      <div className="px-[--spacing-container] py-6">
        <section className="px-0 pt-0 pb-4">
          <h2 className="text-2xl font-bold text-on-surface">Closing Checklist</h2>
        </section>
        <div className="bg-success/10 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-success text-[48px] mb-2">task_alt</span>
          <h3 className="text-lg font-bold text-success">Already Completed Today</h3>
          <p className="text-sm text-on-surface-variant mt-2">
            Submitted by {todayStatus.submittedBy.fullName} at {todayStatus.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Submission success
  if (submitted) {
    return (
      <div className="px-[--spacing-container] py-6">
        <div className="bg-success/10 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-success text-[48px] mb-3">check_circle</span>
          <h3 className="text-xl font-bold text-success">Checklist Submitted</h3>
          <p className="text-sm text-on-surface-variant mt-2">
            {doneCount} of {items.length} items completed. Signed off at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>
      </div>
    );
  }

  // Template loading spinner
  if (selectedTemplateId && templateLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  // Template selection (if multiple)
  if (!selectedTemplateId) {
    return (
      <div className="px-[--spacing-container] py-6">
        <section className="px-0 pt-0 pb-4">
          <h2 className="text-2xl font-bold text-on-surface">Closing Checklist</h2>
          <p className="text-sm text-on-surface-variant mt-1">Select a checklist</p>
        </section>
        <div className="space-y-3">
          {templates?.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplateId(t.id)}
              className="w-full bg-surface-container-lowest rounded-xl p-5 shadow-sm text-left flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">checklist</span>
                <div>
                  <h3 className="font-bold text-on-surface">{t.name}</h3>
                  <p className="text-sm text-on-surface-variant">{t._count.items} items</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline">chevron_right</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Fill-out view
  return (
    <div className="pb-32">
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">{template?.name || 'Checklist'}</h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${items.length > 0 ? (items.filter(i => i.status).length / items.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-on-surface-variant">
            {items.filter(i => i.status).length}/{items.length}
          </span>
        </div>
      </section>

      <section className="px-[--spacing-container] space-y-3">
        {template?.items.map((item, index) => {
          const state = items[index];
          return (
            <div key={item.id} className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm ${state?.status === 'DONE' ? 'border-l-4 border-l-success' : state?.status ? 'border-l-4 border-l-tertiary-container' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className={`font-medium ${state?.status === 'DONE' ? 'text-success line-through' : 'text-on-surface'}`}>
                    {item.label}
                  </p>
                  {!item.isRequired && <span className="text-xs text-outline">Optional</span>}
                  {state?.reason && <p className="text-xs text-on-surface-variant mt-1 italic">"{state.reason}"</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setItemStatus(index, 'DONE')}
                  className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'DONE' ? 'bg-success text-white' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  Done
                </button>
                <button
                  onClick={() => setItemStatus(index, 'SKIPPED')}
                  className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'SKIPPED' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">skip_next</span>
                  Skip
                </button>
                <button
                  onClick={() => setItemStatus(index, 'NOT_APPLICABLE')}
                  className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'NOT_APPLICABLE' ? 'bg-outline text-white' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                  N/A
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Error display */}
      {submit.error && (
        <div className="mx-[--spacing-container] mb-4 bg-error/10 text-error rounded-xl p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          <span className="text-sm font-medium">{submit.error.message}</span>
        </div>
      )}

      {/* Submit button */}
      {allAddressed && (
        <div className="fixed bottom-[80px] left-0 right-0 px-[--spacing-container] pb-4">
          <button
            onClick={() => submit.mutate({ templateId: selectedTemplateId!, items: items.map(i => ({ templateItemId: i.templateItemId, status: i.status!, reason: i.reason || undefined })) })}
            disabled={submit.isPending}
            className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {submit.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Submitting...</> : <><span className="material-symbols-outlined">verified</span>Submit &amp; Sign Off</>}
          </button>
        </div>
      )}

      {/* Reason modal */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setReasonModal(null)}>
          <div className="bg-surface-container-lowest w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-lg font-bold text-on-surface">
              {reasonModal.status === 'SKIPPED' ? 'Why was this skipped?' : 'Why is this not applicable?'}
            </h3>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline resize-none transition-colors"
              autoFocus
            />
            <button
              onClick={confirmReason}
              disabled={!reasonText.trim()}
              className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
