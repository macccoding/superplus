'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import {
  cacheLogbookList,
  readCachedLogbookList,
  readQueuedLogbookMutations,
  removeQueuedLogbookMutation,
  queueLogbookMutation,
} from '@/lib/logbook-offline';
import { LogEntryCard, EmptyState } from '@superplus/ui';

const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };
const statusFilters = [
  { key: 'all', label: 'All', icon: 'notes' },
  { key: 'open', label: 'Open', icon: 'flag' },
  { key: 'flagged', label: 'Flagged', icon: 'priority_high' },
  { key: 'resolved', label: 'Done', icon: 'check_circle' },
] as const;
const categories = [
  { key: '', label: 'All', icon: 'apps', tone: 'bg-surface-white text-on-surface-secondary' },
  { key: 'GENERAL', label: 'General', icon: 'notes', tone: 'bg-surface text-on-surface-secondary' },
  { key: 'HANDOVER', label: 'Handover', icon: 'swap_horiz', tone: 'bg-navy/10 text-navy' },
  { key: 'INVENTORY', label: 'Stock', icon: 'inventory_2', tone: 'bg-warning/15 text-warning' },
  { key: 'INCIDENT', label: 'Incident', icon: 'warning', tone: 'bg-danger/10 text-danger' },
] as const;
const templates = [
  { key: 'HANDOVER', label: 'Handover', icon: 'swap_horiz', category: 'HANDOVER', prompt: 'What needs to carry over to the next shift?', flag: false },
  { key: 'INVENTORY', label: 'Stock', icon: 'inventory_2', category: 'INVENTORY', prompt: 'What item, shelf, or delivery needs attention?', flag: true },
  { key: 'INCIDENT', label: 'Incident', icon: 'warning', category: 'INCIDENT', prompt: 'What happened, where, and who was involved?', flag: true },
  { key: 'CASH', label: 'Register', icon: 'point_of_sale', category: 'GENERAL', prompt: 'What cash, till, or register note should be recorded?', flag: true },
  { key: 'MAINTENANCE', label: 'Repair', icon: 'build', category: 'GENERAL', prompt: 'What equipment or area needs repair?', flag: true },
  { key: 'CUSTOMER', label: 'Customer', icon: 'support_agent', category: 'INCIDENT', prompt: 'What customer issue should management know?', flag: true },
] as const;

type DayMode = 'today' | 'yesterday' | 'search';
type StatusFilter = typeof statusFilters[number]['key'];
type LinkDraftType = 'stock' | 'expiry' | 'incident';
type LinkDraft = { entry: any; type: LinkDraftType } | null;

function jamaicaDateValue(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Jamaica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const base = new Date(
    Number(parts.find((part) => part.type === 'year')?.value),
    Number(parts.find((part) => part.type === 'month')?.value) - 1,
    Number(parts.find((part) => part.type === 'day')?.value)
  );
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function dateForInput(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDay(value: string) {
  return dateForInput(value).toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function linkHref(link: any) {
  if (link.type === 'TASK') return `/hub/tasks/${link.entityId}`;
  if (link.type === 'INCIDENT') return `/tools/incidents/${link.entityId}`;
  if (link.type === 'STOCK_OUT') return '/tools/stock-out';
  if (link.type === 'EXPIRY_ALERT') return '/tools/expiry-tracker';
  if (link.type === 'CHECKLIST') return '/tools/closing-checklist';
  if (link.type === 'PRODUCT') return `/tools/product-lookup/${link.entityId}`;
  return undefined;
}

export default function LogbookPage() {
  const utils = trpc.useUtils();
  const { data: session } = useSession();
  const canManage = roleRank[session?.user?.role || 'STAFF'] >= 2;
  const [dayMode, setDayMode] = useState<DayMode>('today');
  const [customDate, setCustomDate] = useState(jamaicaDateValue());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'note' | 'shift'>('note');
  const [templateKey, setTemplateKey] = useState('HANDOVER');
  const [body, setBody] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [shiftFields, setShiftFields] = useState({ unfinished: '', stock: '', incidents: '', register: '', next: '' });
  const [commentEntry, setCommentEntry] = useState<any | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [receiptEntry, setReceiptEntry] = useState<any | null>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkLocation, setLinkLocation] = useState('');
  const [linkDate, setLinkDate] = useState(jamaicaDateValue(3));
  const [message, setMessage] = useState('');
  const [pendingEntries, setPendingEntries] = useState<ReturnType<typeof readQueuedLogbookMutations>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const markedReadIds = useRef(new Set<string>());

  const selectedDate = dayMode === 'today' ? jamaicaDateValue() : dayMode === 'yesterday' ? jamaicaDateValue(-1) : customDate;
  const template = templates.find((item) => item.key === templateKey) ?? templates[0];
  const listInput = useMemo(() => ({
    date: dateForInput(selectedDate),
    category: category ? category as any : undefined,
    status,
    query: query.trim() || undefined,
  }), [category, query, selectedDate, status]);
  const cacheKey = JSON.stringify({ selectedDate, category, status, query: query.trim() });

  const { data: liveEntries, isLoading, isError } = trpc.logbook.listByDate.useQuery(listInput);
  const { data: openEntries } = trpc.logbook.listByDate.useQuery({ date: dateForInput(selectedDate), status: 'open' });
  const { data: receipts } = trpc.logbook.readReceipts.useQuery(
    { entryId: receiptEntry?.id || '' },
    { enabled: !!receiptEntry && canManage }
  );
  const create = trpc.logbook.create.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const queuedCreate = trpc.logbook.create.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const addAttachment = trpc.logbook.addAttachment.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const addComment = trpc.logbook.addComment.useMutation({
    onSuccess: () => {
      setCommentEntry(null);
      setCommentBody('');
      utils.logbook.invalidate();
    },
  });
  const markRead = trpc.logbook.markRead.useMutation();
  const resolveEntry = trpc.logbook.resolve.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const reopenEntry = trpc.logbook.reopen.useMutation({ onSuccess: () => utils.logbook.invalidate() });
  const createTask = trpc.tasks.createFromSource.useMutation({
    onSuccess: () => {
      setMessage('Follow-up task created.');
      utils.logbook.invalidate();
      utils.tasks.invalidate();
    },
    onError: (error) => setMessage(error.message),
  });
  const createStock = trpc.logbook.createStockOutFromEntry.useMutation({ onSuccess: () => finishLink('Stock-out report created.') });
  const createExpiry = trpc.logbook.createExpiryFromEntry.useMutation({ onSuccess: () => finishLink('Expiry alert created.') });
  const createIncident = trpc.logbook.createIncidentFromEntry.useMutation({ onSuccess: () => finishLink('Incident created.') });

  function finishLink(text: string) {
    setMessage(text);
    setLinkDraft(null);
    setLinkTitle('');
    setLinkLocation('');
    utils.logbook.invalidate();
  }

  useEffect(() => {
    setPendingEntries(readQueuedLogbookMutations());
  }, []);

  useEffect(() => {
    if (liveEntries) cacheLogbookList(cacheKey, liveEntries);
  }, [cacheKey, liveEntries]);

  useEffect(() => {
    const unreadIds = (liveEntries ?? [])
      .filter((entry: any) => entry.isUnread && !markedReadIds.current.has(entry.id))
      .map((entry: any) => entry.id);
    if (unreadIds.length === 0) return;
    unreadIds.forEach((id: string) => markedReadIds.current.add(id));
    markRead.mutate({ entryIds: unreadIds });
  }, [liveEntries]);

  useEffect(() => {
    const flushQueue = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const queue = readQueuedLogbookMutations();
      if (queue.length === 0) return;
      setIsFlushing(true);
      for (const entry of queue) {
        try {
          if (entry.type === 'CREATE') await queuedCreate.mutateAsync(entry.payload as any);
          removeQueuedLogbookMutation(entry.id);
        } catch {
          break;
        }
      }
      setPendingEntries(readQueuedLogbookMutations());
      setIsFlushing(false);
    };
    flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, [queuedCreate]);

  const cached = readCachedLogbookList<any>(cacheKey);
  const entries = liveEntries ?? cached?.entries;
  const usingCache = !liveEntries && !!cached?.entries?.length && isError;
  const openCount = openEntries?.length ?? (entries ?? []).filter((entry: any) => entry.isFlagged && !entry.resolvedAt).length;

  const resetForm = () => {
    setBody('');
    setTemplateKey('HANDOVER');
    setIsFlagged(false);
    setPhotoFile(null);
    setFormMode('note');
    setShiftFields({ unfinished: '', stock: '', incidents: '', register: '', next: '' });
    setShowForm(false);
  };

  const buildShiftBody = () => [
    'End-of-shift summary',
    shiftFields.unfinished && `Unfinished work: ${shiftFields.unfinished}`,
    shiftFields.stock && `Stock issues: ${shiftFields.stock}`,
    shiftFields.incidents && `Incidents/customer issues: ${shiftFields.incidents}`,
    shiftFields.register && `Cash/register notes: ${shiftFields.register}`,
    shiftFields.next && `Next shift: ${shiftFields.next}`,
  ].filter(Boolean).join('\n');
  const formBody = formMode === 'shift' ? buildShiftBody() : body.trim();
  const canSubmitForm = !!formBody && formBody !== 'End-of-shift summary' && !isSaving && !create.isPending;

  const submitEntry = async () => {
    const payload = formMode === 'shift'
      ? { body: buildShiftBody(), category: 'HANDOVER' as any, isFlagged: !!(shiftFields.unfinished || shiftFields.stock || shiftFields.incidents || shiftFields.register) }
      : { body: body.trim(), category: template.category as any, isFlagged };
    if (!payload.body || payload.body === 'End-of-shift summary') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = queueLogbookMutation('CREATE', payload);
      setPendingEntries(readQueuedLogbookMutations());
      setMessage(queued ? 'Will send when online.' : 'Could not save on this phone. Try again online.');
      resetForm();
      return;
    }
    setIsSaving(true);
    try {
      const entry = await create.mutateAsync(payload);
      if (photoFile) {
        try {
          const blob = await upload(photoFile.name, photoFile, { access: 'public', handleUploadUrl: '/api/blob/upload' });
          await addAttachment.mutateAsync({ entryId: entry.id, type: 'IMAGE' as any, url: blob.url, label: photoFile.name });
        } catch {
          setMessage('Log entry saved. Photo upload failed.');
          resetForm();
          return;
        }
      }
      setMessage(photoFile ? 'Log entry and photo saved.' : 'Log entry saved.');
      resetForm();
    } catch {
      const queued = queueLogbookMutation('CREATE', payload);
      setPendingEntries(readQueuedLogbookMutations());
      setMessage(queued ? 'Will send when online. Photo uploads need internet.' : 'Could not save this entry.');
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const submitLinkDraft = () => {
    if (!linkDraft || !linkTitle.trim()) return;
    if (linkDraft.type === 'stock') createStock.mutate({ entryId: linkDraft.entry.id, productName: linkTitle.trim(), location: linkLocation.trim() || undefined });
    if (linkDraft.type === 'expiry') createExpiry.mutate({ entryId: linkDraft.entry.id, productName: linkTitle.trim(), expiryDate: dateForInput(linkDate), location: linkLocation.trim() || undefined });
    if (linkDraft.type === 'incident') createIncident.mutate({ entryId: linkDraft.entry.id, title: linkTitle.trim(), severity: 'MEDIUM' as any });
  };

  const openLinkDraft = (entry: any, type: LinkDraftType) => {
    setLinkDraft({ entry, type });
    setLinkTitle(entry.category === 'INVENTORY' ? entry.body.slice(0, 60) : '');
    setLinkLocation('');
  };

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">Logbook</h2>
            <p className="mt-1 text-sm text-on-surface-secondary">{formatDay(selectedDate)}</p>
          </div>
          <div className="rounded-[--radius-lg] bg-danger/10 px-3 py-2 text-center text-danger">
            <div className="text-2xl font-black leading-none">{openCount}</div>
            <div className="text-xs font-bold">Open</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['today', 'yesterday', 'search'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setDayMode(mode);
                if (mode !== 'search') setQuery('');
              }}
              className={`min-h-12 rounded-[--radius-lg] px-2 text-sm font-bold capitalize active:scale-95 transition-all ${dayMode === mode ? 'bg-brand text-on-brand' : 'bg-surface-white text-on-surface-secondary'}`}
            >
              {mode}
            </button>
          ))}
        </div>

        {dayMode === 'search' && (
          <div className="mt-3 grid gap-2">
            <input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="h-12 rounded-[--radius-lg] border-2 border-outline bg-surface-white px-4 text-base font-bold text-on-surface focus:border-primary focus:outline-none" />
            <label className="relative block">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-secondary text-[20px]">search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface-white pl-11 pr-4 text-base text-on-surface placeholder:text-on-surface-secondary focus:border-primary focus:outline-none" />
            </label>
          </div>
        )}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <button key={filter.key} onClick={() => setStatus(filter.key)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-[--radius-lg] px-4 text-sm font-bold active:scale-95 transition-all ${status === filter.key ? 'bg-navy text-on-brand' : 'bg-surface-white text-on-surface-secondary'}`}>
              <span className="material-symbols-outlined text-[18px]">{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button key={item.key || 'ALL'} onClick={() => setCategory(item.key)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-[--radius-lg] px-4 text-sm font-bold active:scale-95 transition-all ${category === item.key ? 'ring-2 ring-primary ' + item.tone : item.tone}`}>
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {(message || usingCache || pendingEntries.length > 0) && (
          <div className="mt-3 rounded-[--radius-lg] bg-warning/10 px-4 py-3 text-sm font-bold text-on-surface">
            {usingCache ? 'Showing saved notes. ' : ''}
            {pendingEntries.length > 0 ? `${pendingEntries.length} waiting to send. ` : ''}
            {isFlushing ? 'Sending now. ' : ''}
            {message}
          </div>
        )}
      </section>

      <section className="space-y-3 px-5 pb-40">
        {isLoading && !entries ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : entries && entries.length > 0 ? (
          entries.map((entry: any) => {
            const isResolved = !!entry.resolvedAt;
            const isOpen = entry.isFlagged && !isResolved;
            return (
              <LogEntryCard
                key={entry.id}
                body={entry.body}
                author={entry.author.fullName}
                category={entry.category}
                isFlagged={entry.isFlagged}
                isResolved={isResolved}
                isUnread={entry.isUnread}
                resolvedBy={entry.resolvedBy?.fullName}
                resolvedAt={entry.resolvedAt ? formatTime(entry.resolvedAt) : null}
                createdAt={formatTime(entry.createdAt)}
                actions={(
                  <>
                    <button onClick={() => setCommentEntry(entry)} className="min-h-12 rounded-[--radius-lg] bg-surface px-3 text-sm font-bold text-on-surface-secondary active:scale-95">
                      <span className="material-symbols-outlined align-middle text-[18px]">chat_bubble</span>
                      Reply
                    </button>
                    {canManage ? (
                      <button onClick={() => isOpen ? resolveEntry.mutate({ entryId: entry.id }) : reopenEntry.mutate({ entryId: entry.id })} disabled={!entry.isFlagged || resolveEntry.isPending || reopenEntry.isPending} className={`min-h-12 rounded-[--radius-lg] px-3 text-sm font-bold disabled:opacity-40 active:scale-95 ${isOpen ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        <span className="material-symbols-outlined align-middle text-[18px]">{isOpen ? 'check_circle' : 'undo'}</span>
                        {isOpen ? 'Resolve' : 'Reopen'}
                      </button>
                    ) : (
                      <button disabled className="min-h-12 rounded-[--radius-lg] bg-navy/10 px-3 text-sm font-bold text-navy">
                        <span className="material-symbols-outlined align-middle text-[18px]">visibility</span>
                        Seen {entry.seenByCount ?? 0}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => createTask.mutate({ sourceType: 'LOGBOOK' as any, sourceId: entry.id, sourceLabel: entry.body.slice(0, 80), title: `${entry.category.toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())} follow-up`, description: entry.body, category: 'Logbook', priority: entry.category === 'INCIDENT' ? 'HIGH' as any : 'NORMAL' as any })} disabled={createTask.isPending} className="min-h-12 rounded-[--radius-lg] bg-navy/10 px-3 text-sm font-bold text-navy disabled:opacity-50 active:scale-95">
                          <span className="material-symbols-outlined align-middle text-[18px]">add_task</span>
                          Task
                        </button>
                        <button onClick={() => setReceiptEntry(entry)} className="min-h-12 rounded-[--radius-lg] bg-surface px-3 text-sm font-bold text-on-surface-secondary active:scale-95">
                          <span className="material-symbols-outlined align-middle text-[18px]">visibility</span>
                          Seen {entry.seenByCount ?? 0}
                        </button>
                      </>
                    )}
                  </>
                )}
                details={(
                  <>
                    {(entry.attachments?.length > 0 || entry.links?.length > 0 || entry.comments?.length > 0) && (
                      <div className="space-y-2">
                        {entry.attachments?.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto">
                            {entry.attachments.map((attachment: any) => (
                              <a key={attachment.id} href={attachment.url} target="_blank" className="block h-20 w-20 shrink-0 overflow-hidden rounded-[--radius-lg] bg-surface">
                                {attachment.type === 'IMAGE' ? <img src={attachment.url} alt={attachment.label || 'Log attachment'} className="h-full w-full object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center text-on-surface-secondary">attach_file</span>}
                              </a>
                            ))}
                          </div>
                        )}
                        {entry.links?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.links.map((link: any) => {
                              const href = linkHref(link);
                              const label = `${link.type.replaceAll('_', ' ')}: ${link.label || link.entityId}`;
                              return href ? <a key={link.id} href={href} className="rounded-full bg-navy/10 px-2 py-1 text-xs font-bold text-navy">{label}</a> : <span key={link.id} className="rounded-full bg-surface px-2 py-1 text-xs font-bold text-on-surface-secondary">{label}</span>;
                            })}
                          </div>
                        )}
                        {entry.comments?.length > 0 && (
                          <div className="space-y-2 rounded-[--radius-lg] bg-surface p-3">
                            {entry.comments.slice(0, 3).map((comment: any) => (
                              <p key={comment.id} className="text-sm text-on-surface"><span className="font-bold">{comment.author.fullName}:</span> {comment.body}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {canManage && (
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => openLinkDraft(entry, 'stock')} className="min-h-10 rounded-[--radius-md] bg-warning/10 text-xs font-bold text-warning">Stock</button>
                        <button onClick={() => openLinkDraft(entry, 'expiry')} className="min-h-10 rounded-[--radius-md] bg-success/10 text-xs font-bold text-success">Expiry</button>
                        <button onClick={() => openLinkDraft(entry, 'incident')} className="min-h-10 rounded-[--radius-md] bg-danger/10 text-xs font-bold text-danger">Incident</button>
                      </div>
                    )}
                  </>
                )}
              />
            );
          })
        ) : (
          <EmptyState icon="swap_horiz" title="No handover notes yet" description="Add the first note for this shift" />
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowForm(false)}>
          <div className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border-t-2 border-surface-variant bg-surface-white p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFormMode('note')} className={`min-h-12 rounded-[--radius-lg] text-sm font-bold ${formMode === 'note' ? 'bg-brand text-on-brand' : 'bg-surface text-on-surface-secondary'}`}>Quick Note</button>
              <button onClick={() => setFormMode('shift')} className={`min-h-12 rounded-[--radius-lg] text-sm font-bold ${formMode === 'shift' ? 'bg-brand text-on-brand' : 'bg-surface text-on-surface-secondary'}`}>End Shift</button>
            </div>

            {formMode === 'note' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((item) => (
                    <button key={item.key} onClick={() => { setTemplateKey(item.key); setIsFlagged(item.flag); }} className={`min-h-14 rounded-[--radius-lg] px-3 text-sm font-bold active:scale-95 ${templateKey === item.key ? 'bg-navy text-on-brand' : 'bg-surface text-on-surface-secondary'}`}>
                      <span className="material-symbols-outlined mr-1 align-middle text-[20px]">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={template.prompt} rows={4} className="w-full resize-none rounded-[--radius-lg] border-2 border-outline bg-surface px-4 py-3 text-base text-on-surface placeholder:text-on-surface-secondary transition-colors focus:border-primary focus:outline-none" autoFocus />
              </>
            ) : (
              <div className="space-y-3">
                {[
                  ['unfinished', 'Unfinished work'],
                  ['stock', 'Stock issues'],
                  ['incidents', 'Incidents or customer issues'],
                  ['register', 'Cash/register notes'],
                  ['next', 'Message for next shift'],
                ].map(([key, label]) => (
                  <textarea key={key} value={(shiftFields as any)[key]} onChange={(event) => setShiftFields((current) => ({ ...current, [key]: event.target.value }))} placeholder={label} rows={2} className="w-full resize-none rounded-[--radius-lg] border-2 border-outline bg-surface px-4 py-3 text-base text-on-surface placeholder:text-on-surface-secondary focus:border-primary focus:outline-none" />
                ))}
              </div>
            )}

            <label className="flex min-h-12 cursor-pointer items-center gap-3" onClick={() => setIsFlagged(!isFlagged)}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors ${isFlagged ? 'border-danger bg-danger' : 'border-outline'}`}>
                {isFlagged && <span className="material-symbols-outlined text-on-brand text-[18px]">check</span>}
              </div>
              <span className="text-base font-bold text-on-surface">Needs manager attention</span>
            </label>

            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[--radius-lg] bg-surface px-4 text-sm font-bold text-on-surface-secondary">
              <span className="material-symbols-outlined">photo_camera</span>
              {photoFile ? photoFile.name : 'Add Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="h-14 rounded-[--radius-lg] border-2 border-outline font-bold text-on-surface-secondary active:scale-95 transition-all">Cancel</button>
              <button onClick={submitEntry} disabled={!canSubmitForm} className="h-14 rounded-[--radius-lg] bg-brand font-bold text-on-brand disabled:opacity-40 active:scale-95 transition-all">{isSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {commentEntry && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => { setCommentEntry(null); setCommentBody(''); }}>
          <div className="w-full space-y-3 rounded-t-2xl bg-surface-white p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-bold text-on-surface">Reply</h3>
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Add follow-up" rows={3} className="w-full resize-none rounded-[--radius-lg] border-2 border-outline bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none" autoFocus />
            <button onClick={() => addComment.mutate({ entryId: commentEntry.id, body: commentBody })} disabled={!commentBody.trim() || addComment.isPending} className="h-14 w-full rounded-[--radius-lg] bg-brand font-bold text-on-brand disabled:opacity-40">Post Reply</button>
          </div>
        </div>
      )}

      {receiptEntry && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setReceiptEntry(null)}>
          <div className="max-h-[80vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-surface-white p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-bold text-on-surface">Seen Details</h3>
            <div>
              <p className="mb-2 text-sm font-bold text-success">Seen</p>
              {(receipts?.seenBy ?? []).map((user: any) => <p key={user.id} className="py-2 text-sm text-on-surface">{user.fullName} · {formatTime(user.readAt)}</p>)}
              {receipts?.seenBy?.length === 0 && <p className="text-sm text-on-surface-secondary">No views yet.</p>}
            </div>
            {canManage && (
              <div>
                <p className="mb-2 text-sm font-bold text-warning">Not Seen</p>
                {(receipts?.notSeenBy ?? []).map((user: any) => <p key={user.id} className="py-2 text-sm text-on-surface">{user.fullName}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {linkDraft && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setLinkDraft(null)}>
          <div className="w-full space-y-3 rounded-t-2xl bg-surface-white p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-bold text-on-surface">Create {linkDraft.type}</h3>
            <input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder={linkDraft.type === 'incident' ? 'Incident title' : 'Product name'} className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-base focus:border-primary focus:outline-none" />
            {linkDraft.type !== 'incident' && <input value={linkLocation} onChange={(event) => setLinkLocation(event.target.value)} placeholder="Location" className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-base focus:border-primary focus:outline-none" />}
            {linkDraft.type === 'expiry' && <input type="date" value={linkDate} onChange={(event) => setLinkDate(event.target.value)} className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-base focus:border-primary focus:outline-none" />}
            <button onClick={submitLinkDraft} disabled={!linkTitle.trim() || createStock.isPending || createExpiry.isPending || createIncident.isPending} className="h-14 w-full rounded-[--radius-lg] bg-brand font-bold text-on-brand disabled:opacity-40">Create Link</button>
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(true)} className="fixed bottom-24 left-5 right-5 z-30 flex min-h-14 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand text-lg font-black text-on-brand shadow-lg active:scale-95 transition-all">
        <span className="material-symbols-outlined text-[26px]">add</span>
        Add Entry
      </button>
    </div>
  );
}
