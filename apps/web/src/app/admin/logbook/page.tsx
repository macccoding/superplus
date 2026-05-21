'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@superplus/ui';
import { trpc } from '@/lib/trpc-client';

const categories = ['', 'GENERAL', 'HANDOVER', 'INVENTORY', 'INCIDENT'] as const;
const statuses = ['open', 'all', 'resolved'] as const;

function todayValue() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Jamaica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function dateForInput(value: string) {
  return new Date(`${value}T12:00:00`);
}

export default function AdminLogbookPage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const activeStores = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = activeStores.length > 1;
  const [scope, setScope] = useState('ALL');
  const [date, setDate] = useState(todayValue());
  const [status, setStatus] = useState<typeof statuses[number]>('open');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const activeScope = canUseAllStores ? scope : activeStores[0]?.id;
  const digestInput = useMemo(() => ({ scope: activeScope, date: dateForInput(date) }), [activeScope, date]);
  const queueInput = useMemo(() => ({
    scope: activeScope,
    status,
    category: category ? category as any : undefined,
    query: query.trim() || undefined,
    take: 80,
  }), [activeScope, category, query, status]);

  const { data: digest } = trpc.logbook.dailyDigest.useQuery(digestInput, { enabled: !!activeScope });
  const { data: queue, isLoading } = trpc.logbook.reviewQueue.useQuery(queueInput, { enabled: !!activeScope });
  const resolveEntry = trpc.logbook.resolve.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const reopenEntry = trpc.logbook.reopen.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const createTask = trpc.admin.createTaskFromAttention.useMutation({ onSuccess: () => { utils.logbook.invalidate(); utils.admin.invalidate(); utils.tasks.invalidate(); } });

  return (
    <div className="space-y-6">
      <PageHeader title="Logbook Review" subtitle="Daily handover digest and unresolved follow-ups" />

      <div className="rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select value={activeScope ?? ''} onChange={(event) => setScope(event.target.value)} className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 font-bold text-on-surface">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {activeStores.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 font-bold text-on-surface" />
          <select value={status} onChange={(event) => setStatus(event.target.value as any)} className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 font-bold text-on-surface">
            {statuses.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 font-bold text-on-surface">
            {categories.map((item) => <option key={item || 'ALL'} value={item}>{item || 'ALL CATEGORIES'}</option>)}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 text-on-surface focus:border-primary focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon="notes" label="Entries" value={digest?.entries ?? 0} onClick={() => { setStatus('all'); setCategory(''); }} />
        <Metric icon="flag" label="Open" value={digest?.openCount ?? 0} danger={(digest?.openCount ?? 0) > 0} onClick={() => { setStatus('open'); setCategory(''); }} />
        <Metric icon="check_circle" label="Resolved" value={digest?.resolvedCount ?? 0} onClick={() => { setStatus('resolved'); setCategory(''); }} />
        <Metric icon="swap_horiz" label="Handover" value={digest?.handovers ?? 0} onClick={() => { setStatus('all'); setCategory('HANDOVER'); }} />
        <Metric icon="inventory_2" label="Stock" value={digest?.inventoryNotes ?? 0} onClick={() => { setStatus('all'); setCategory('INVENTORY'); }} />
        <Metric icon="add_task" label="Tasks" value={digest?.tasksCreated ?? 0} />
      </div>

      {digest?.openFlags?.length ? (
        <div className="rounded-[--radius-lg] bg-warning/10 p-4">
          <h2 className="mb-3 font-extrabold text-on-surface">Today’s Open Handover</h2>
          <div className="space-y-2">
            {digest.openFlags.map((entry: any) => (
              <Link key={entry.id} href="/hub/logbook" className="block rounded-[--radius-lg] bg-surface-white p-3">
                <p className="font-bold text-on-surface">{entry.body.slice(0, 120)}</p>
                <p className="mt-1 text-xs text-on-surface-secondary">{entry.store?.name} · {entry.author?.fullName}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[--radius-lg] bg-surface-white shadow-sm">
        <div className="border-b border-outline/20 px-4 py-3">
          <h2 className="font-extrabold text-on-surface">Review Queue</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>
        ) : queue?.length ? (
          <div className="divide-y divide-outline/10">
            {queue.map((entry: any) => {
              const isOpen = entry.isFlagged && !entry.resolvedAt;
              return (
                <div key={entry.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${isOpen ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>{isOpen ? 'OPEN' : entry.resolvedAt ? 'RESOLVED' : entry.category}</span>
                      <span className="rounded-full bg-surface px-2 py-1 text-xs font-bold text-on-surface-secondary">{entry.category}</span>
                      <span className="text-xs text-on-surface-secondary">{entry.store?.name} · {entry.author?.fullName}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{entry.body}</p>
                    <p className="mt-2 text-xs font-bold text-on-surface-secondary">
                      {entry._count.comments} replies · {entry._count.reads} seen · {entry._count.attachments} files · {entry._count.links} links
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 lg:self-start">
                    <Link href="/hub/logbook" className="flex min-h-11 items-center justify-center rounded-[--radius-lg] bg-surface text-sm font-bold text-on-surface-secondary">Open</Link>
                    <button onClick={() => isOpen ? resolveEntry.mutate({ entryId: entry.id, scope: activeScope }) : reopenEntry.mutate({ entryId: entry.id, scope: activeScope })} className={`min-h-11 rounded-[--radius-lg] text-sm font-bold ${isOpen ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{isOpen ? 'Resolve' : 'Reopen'}</button>
                    <button onClick={() => createTask.mutate({ scope: activeScope, type: 'FLAGGED_LOG', sourceId: entry.id, title: `${entry.category.toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())} follow-up` })} className="col-span-2 min-h-11 rounded-[--radius-lg] bg-navy/10 text-sm font-bold text-navy">Create Task</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-on-surface-secondary">
            <span className="material-symbols-outlined text-[44px]">check_circle</span>
            <p className="mt-3 font-bold text-on-surface">No log entries need review</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, danger, onClick }: { icon: string; label: string; value: number; danger?: boolean; onClick?: () => void }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`material-symbols-outlined text-[24px] ${danger ? 'text-danger' : 'text-navy'}`}>{icon}</span>
        {onClick && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-secondary">chevron_right</span>}
      </div>
      <p className="mt-3 text-3xl font-black text-on-surface">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`rounded-[--radius-lg] bg-surface-white p-4 text-left shadow-sm transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 hover:shadow-md ${danger ? 'border-l-4 border-l-danger' : ''}`}>
        {content}
      </button>
    );
  }
  return (
    <div className={`rounded-[--radius-lg] bg-surface-white p-4 shadow-sm ${danger ? 'border-l-4 border-l-danger' : ''}`}>
      {content}
    </div>
  );
}
