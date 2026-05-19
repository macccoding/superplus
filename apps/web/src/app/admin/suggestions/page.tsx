'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

const statusLabels: Record<string, string> = { NEW: 'New', REVIEWED: 'Reviewed', IMPLEMENTED: 'Implemented', DISMISSED: 'Dismissed' };
const categories = ['GENERAL', 'SAFETY', 'SCHEDULE', 'EQUIPMENT', 'PROCESS', 'OTHER'];

export default function AdminSuggestionsPage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('NEW');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<string>('REVIEWED');
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: suggestions, isLoading } = trpc.suggestions.listAll.useQuery({
    scope: activeScope,
    status: statusFilter === 'ALL' ? undefined : statusFilter as any,
    category: categoryFilter === 'ALL' ? undefined : categoryFilter as any,
    search: search.trim() || undefined,
  });

  const respond = trpc.suggestions.respond.useMutation({
    onSuccess: () => {
      utils.suggestions.invalidate();
      utils.admin.invalidate();
      setRespondingId(null);
      setResponse('');
    },
  });
  const createTask = trpc.admin.createTaskFromAttention.useMutation({
    onSuccess: () => {
      utils.suggestions.invalidate();
      utils.admin.invalidate();
      utils.tasks.invalidate();
    },
  });

  const counts = {
    new: suggestions?.filter((item: any) => item.status === 'NEW').length ?? 0,
    implemented: suggestions?.filter((item: any) => item.status === 'IMPLEMENTED').length ?? 0,
    dismissed: suggestions?.filter((item: any) => item.status === 'DISMISSED').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Suggestions</h1>
          <p className="text-on-surface-secondary mt-1">Review, respond, and convert good ideas into work</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="New" value={counts.new} />
          <MiniStat label="Done" value={counts.implemented} />
          <MiniStat label="Dismissed" value={counts.dismissed} />
        </div>
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[180px_160px_180px_1fr]">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Status filter">
            <option value="NEW">New</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="IMPLEMENTED">Implemented</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="ALL">All Statuses</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Category filter">
            <option value="ALL">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}
          </select>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-secondary">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suggestions" className="w-full h-12 pl-12 pr-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {suggestions?.map((s: any) => (
            <div key={s.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface leading-relaxed font-medium">{s.body}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <StatusPill status={s.status} />
                    <span className="text-xs font-bold text-on-surface-secondary bg-surface-cream px-2 py-1 rounded-full">{s.category.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-on-surface-secondary">{s.store?.name}</span>
                    <span className="text-xs text-on-surface-secondary">·</span>
                    <span className="text-xs text-on-surface-secondary">{s.author?.fullName || 'Anonymous'}</span>
                    <span className="text-xs text-on-surface-secondary">·</span>
                    <span className="text-xs text-on-surface-secondary">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button onClick={() => createTask.mutate({ scope: activeScope, type: 'SUGGESTION', sourceId: s.id, title: `Follow up suggestion: ${s.body.slice(0, 70)}` })} className="h-12 px-3 rounded-[--radius-lg] bg-brand text-on-brand text-sm font-bold">Convert</button>
                  <button onClick={() => { setRespondingId(s.id); setResponse(s.response || ''); setStatus(s.status === 'NEW' ? 'REVIEWED' : s.status); }} className="h-12 px-3 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface-secondary">Respond</button>
                </div>
              </div>
              {s.response && (
                <div className="mt-4 bg-navy/5 rounded-[--radius-lg] p-3">
                  <p className="text-xs font-bold text-navy mb-1">Response by {s.respondedBy?.fullName || 'Admin'}{s.respondedAt ? ` · ${new Date(s.respondedAt).toLocaleDateString()}` : ''}</p>
                  <p className="text-sm text-on-surface">{s.response}</p>
                </div>
              )}
              {respondingId === s.id && (
                <div className="mt-4 space-y-3 border-t border-outline/20 pt-4">
                  <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a response..." rows={3} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-on-surface-secondary resize-none" />
                  <div className="grid grid-cols-3 gap-2">
                    {['REVIEWED', 'IMPLEMENTED', 'DISMISSED'].map((st) => (
                      <button key={st} onClick={() => setStatus(st)} className={`h-11 rounded-[--radius-lg] text-xs font-bold ${status === st ? 'bg-brand text-on-brand' : 'bg-surface-cream text-on-surface-secondary'}`}>
                        {statusLabels[st]}
                      </button>
                    ))}
                  </div>
                  {respond.error && <p className="text-sm font-bold text-error">{respond.error.message}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setRespondingId(null)} className="flex-1 h-12 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Cancel</button>
                    <button onClick={() => respond.mutate({ id: s.id, response, status: status as any, scope: activeScope })} disabled={!response.trim()} className="flex-1 h-12 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40">Save</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {suggestions?.length === 0 && (
            <div className="bg-surface-white rounded-[--radius-lg] p-10 text-center shadow-sm">
              <span className="material-symbols-outlined text-[44px] text-on-surface-secondary">lightbulb</span>
              <p className="font-bold text-on-surface mt-3">{statusFilter === 'NEW' ? 'No new suggestions' : 'No suggestions match these filters'}</p>
              <p className="text-sm text-on-surface-secondary mt-1">Try a different status, category, or store.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-white rounded-[--radius-lg] min-w-[88px] p-3 text-center shadow-sm">
      <p className="text-xl font-extrabold text-on-surface">{value}</p>
      <p className="text-[10px] font-bold uppercase text-on-surface-secondary">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = status === 'IMPLEMENTED' ? 'bg-success/10 text-success' : status === 'REVIEWED' ? 'bg-navy/10 text-navy' : status === 'DISMISSED' ? 'bg-outline/10 text-on-surface-secondary' : 'bg-warning/15 text-warning';
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles}`}>{statusLabels[status] || status}</span>;
}
