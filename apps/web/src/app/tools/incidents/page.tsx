'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

const categoryIcons: Record<string, string> = {
  EQUIPMENT: 'construction', SAFETY: 'health_and_safety', CUSTOMER: 'support_agent',
  THEFT: 'gpp_bad', MAINTENANCE: 'plumbing', OTHER: 'more_horiz',
};
const severityConfig: Record<string, { color: string; label: string }> = {
  CRITICAL: { color: 'bg-error text-on-error', label: 'Critical' },
  HIGH: { color: 'bg-tertiary-container text-on-tertiary-container', label: 'High' },
  MEDIUM: { color: 'bg-surface-container-high text-on-surface-variant', label: 'Medium' },
  LOW: { color: 'bg-outline-variant/30 text-on-surface-variant', label: 'Low' },
};

export default function IncidentsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: incidents } = trpc.incidents.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ category: 'OTHER' as string, title: '', description: '', severity: 'MEDIUM' as string });

  const create = trpc.incidents.create.useMutation({
    onSuccess: () => { utils.incidents.invalidate(); setShowCreate(false); setForm({ category: 'OTHER', title: '', description: '', severity: 'MEDIUM' }); },
  });

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Incidents</h2>
        <p className="text-sm text-on-surface-variant mt-1">{incidents?.filter((i: any) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length || 0} open</p>
      </section>

      <section className="px-[--spacing-container] pb-24 space-y-3">
        {incidents && incidents.length > 0 ? (
          incidents.map((incident: any) => {
            const sev = severityConfig[incident.severity] || severityConfig.MEDIUM;
            return (
              <button key={incident.id} onClick={() => router.push(`/tools/incidents/${incident.id}`)} className="w-full text-left bg-surface-container-lowest rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-secondary">{categoryIcons[incident.category] || 'report'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-on-surface truncate">{incident.title}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${sev.color}`}>{sev.label}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1 line-clamp-1">{incident.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-outline">{incident.reportedBy.fullName}</span>
                      <span className="text-xs text-outline">·</span>
                      <span className={`text-xs font-medium ${incident.status === 'OPEN' ? 'text-error' : incident.status === 'RESOLVED' ? 'text-success' : 'text-on-surface-variant'}`}>{incident.status}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <EmptyState icon="verified_user" title="No incidents" description="No incidents reported" />
        )}
      </section>

      {/* Create form */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-container-lowest w-full rounded-t-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
              <h3 className="text-xl font-bold text-on-surface">Log Incident</h3>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryIcons).map(([cat, icon]) => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })} className={`py-3 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${form.category === cat ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief title" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline transition-colors" />

              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened?" rows={3} className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline resize-none transition-colors" />

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-2">Severity</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((s) => (
                    <button key={s} onClick={() => setForm({ ...form, severity: s })} className={`py-2.5 rounded-xl text-xs font-bold transition-all ${form.severity === s ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 shrink-0">
              <button
                onClick={() => create.mutate({ category: form.category as any, title: form.title, description: form.description, severity: form.severity as any })}
                disabled={!form.title.trim() || !form.description.trim() || create.isPending}
                className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
              >
                Log Incident
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowCreate(true)} className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-secondary text-on-secondary shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
