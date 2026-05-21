'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import {
  cacheThreadList,
  clearQueuedThreadMutations,
  readCachedThreadList,
  readQueuedThreadMutations,
  removeQueuedThreadMutation,
} from '@/lib/thread-offline';
import { ThreadCard, EmptyState, PageHeader, PageSkeleton } from '@superplus/ui';

type Tab = 'all' | 'unread' | 'mentioned' | 'pinned' | 'saved' | 'urgent' | 'noReply' | 'needsTask' | 'unacked' | 'resolved';
const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };
const viewByTab: Record<Tab, 'ALL' | 'UNREAD' | 'MENTIONED' | 'PINNED' | 'SAVED' | 'URGENT' | 'NO_REPLY' | 'NEEDS_TASK' | 'UNACKED' | 'RESOLVED'> = {
  all: 'ALL',
  unread: 'UNREAD',
  mentioned: 'MENTIONED',
  pinned: 'PINNED',
  saved: 'SAVED',
  urgent: 'URGENT',
  noReply: 'NO_REPLY',
  needsTask: 'NEEDS_TASK',
  unacked: 'UNACKED',
  resolved: 'RESOLVED',
};
const tabs: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: 'forum' },
  { key: 'unread', label: 'New', icon: 'mark_chat_unread' },
  { key: 'mentioned', label: '@Me', icon: 'alternate_email' },
  { key: 'pinned', label: 'Pinned', icon: 'push_pin' },
  { key: 'saved', label: 'Saved', icon: 'bookmark' },
  { key: 'urgent', label: 'Urgent', icon: 'priority_high' },
  { key: 'noReply', label: 'No Reply', icon: 'mark_chat_unread' },
  { key: 'needsTask', label: 'Needs Task', icon: 'add_task' },
  { key: 'unacked', label: 'Unacked', icon: 'check_circle' },
  { key: 'resolved', label: 'Done', icon: 'check_circle' },
];
const emptyCopy: Record<Tab, { icon: string; title: string; description: string }> = {
  all: { icon: 'forum', title: 'No threads yet', description: 'Start a conversation with your team' },
  unread: { icon: 'mark_chat_read', title: 'All caught up', description: 'New replies will show here' },
  mentioned: { icon: 'alternate_email', title: 'No mentions', description: 'Messages asking for you will show here' },
  pinned: { icon: 'push_pin', title: 'Nothing pinned', description: 'Supervisors can pin important threads' },
  saved: { icon: 'bookmark', title: 'No saved threads', description: 'Save threads you want to find again' },
  urgent: { icon: 'priority_high', title: 'No urgent threads', description: 'Urgent store issues will show here' },
  noReply: { icon: 'mark_chat_unread', title: 'All replied to', description: 'Threads without replies will show here' },
  needsTask: { icon: 'add_task', title: 'No task needed', description: 'Threads without linked tasks will show here' },
  unacked: { icon: 'check_circle', title: 'All urgent threads acknowledged', description: 'Urgent threads without ACKs will show here' },
  resolved: { icon: 'check_circle', title: 'No finished threads', description: 'Resolved conversations will show here' },
};

function validTab(value: string | null): Tab {
  if (value === 'unread' || value === 'mentioned' || value === 'pinned' || value === 'saved' || value === 'urgent' || value === 'noReply' || value === 'needsTask' || value === 'unacked' || value === 'resolved' || value === 'all') return value;
  return 'all';
}

function formatThreadDate(value: Date | string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ThreadsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>(() => validTab(searchParams.get('tab')));
  const [cachedThreads, setCachedThreads] = useState<Record<Tab, any[] | undefined>>({
    all: undefined,
    unread: undefined,
    mentioned: undefined,
    pinned: undefined,
    saved: undefined,
    urgent: undefined,
    noReply: undefined,
    needsTask: undefined,
    unacked: undefined,
    resolved: undefined,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingEntries, setPendingEntries] = useState<ReturnType<typeof readQueuedThreadMutations>>([]);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [authorId, setAuthorId] = useState('');
  const [mentionedUserId, setMentionedUserId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'RESOLVED' | 'ANY'>('ACTIVE');
  const [hasAttachment, setHasAttachment] = useState('');
  const [hasTask, setHasTask] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [health, setHealth] = useState('');
  const [isFlushing, setIsFlushing] = useState(false);
  const [failedFlushCount, setFailedFlushCount] = useState(0);
  const canManage = roleRank[session?.user?.role || 'STAFF'] >= 2;
  const listInput = useMemo(() => ({
    view: viewByTab[tab],
    search: search.trim() || undefined,
    authorId: authorId || undefined,
    mentionedUserId: mentionedUserId || undefined,
    category: category ? category as any : undefined,
    status,
    hasAttachment: hasAttachment === '' ? undefined : hasAttachment === 'yes',
    hasTask: hasTask === '' ? undefined : hasTask === 'yes',
    dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
    health: health ? health as any : undefined,
  }), [authorId, category, dateFrom, dateTo, hasAttachment, hasTask, health, mentionedUserId, search, status, tab]);

  const { data: liveThreads, isLoading, isError } = trpc.threads.list.useQuery(listInput);
  const { data: counts } = trpc.threads.counts.useQuery();
  const { data: mentionTargets } = trpc.threads.mentionTargets.useQuery(undefined, { enabled: filtersOpen });
  const queuedCreate = trpc.threads.create.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const queuedReply = trpc.threads.reply.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const queuedReact = trpc.threads.react.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const queuedRead = trpc.threads.markRead.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const markAllRead = trpc.threads.markAllRead.useMutation({ onSuccess: () => utils.threads.invalidate() });

  useEffect(() => {
    const nextTab = validTab(searchParams.get('tab'));
    if (nextTab !== tab) setTab(nextTab);
  }, [searchParams, tab]);

  useEffect(() => {
    setCachedThreads({
      all: readCachedThreadList<any>('all')?.threads,
      unread: readCachedThreadList<any>('unread')?.threads,
      mentioned: readCachedThreadList<any>('mentioned')?.threads,
      pinned: readCachedThreadList<any>('pinned')?.threads,
      saved: readCachedThreadList<any>('saved')?.threads,
      urgent: readCachedThreadList<any>('urgent')?.threads,
      noReply: readCachedThreadList<any>('noReply')?.threads,
      needsTask: readCachedThreadList<any>('needsTask')?.threads,
      unacked: readCachedThreadList<any>('unacked')?.threads,
      resolved: readCachedThreadList<any>('resolved')?.threads,
    });
    const queue = readQueuedThreadMutations();
    setPendingEntries(queue);
    setPendingCount(queue.length);
  }, []);

  useEffect(() => {
    if (liveThreads) cacheThreadList(tab, liveThreads);
  }, [liveThreads, tab]);

  useEffect(() => {
    const flushQueue = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const queue = readQueuedThreadMutations();
      if (queue.length === 0) {
        setFailedFlushCount(0);
        return;
      }
      setIsFlushing(true);
      let failed = 0;
      for (const entry of queue) {
        try {
          if (entry.type === 'CREATE') await queuedCreate.mutateAsync(entry.payload as any);
          if (entry.type === 'REPLY') await queuedReply.mutateAsync(entry.payload as any);
          if (entry.type === 'REACT') await queuedReact.mutateAsync(entry.payload as any);
          if (entry.type === 'MARK_READ') await queuedRead.mutateAsync(entry.payload as any);
          removeQueuedThreadMutation(entry.id);
        } catch {
          failed += 1;
          break;
        }
      }
      setIsFlushing(false);
      setFailedFlushCount(failed);
      const nextQueue = readQueuedThreadMutations();
      setPendingEntries(nextQueue);
      setPendingCount(nextQueue.length);
    };
    flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, [queuedCreate, queuedRead, queuedReact, queuedReply]);

  const threads = liveThreads ?? cachedThreads[tab];
  const usingCache = !liveThreads && !!cachedThreads[tab]?.length && isError;
  const tabCounts: Record<Tab, number> = {
    all: counts?.all ?? (cachedThreads.all ?? []).length,
    unread: counts?.unread ?? (cachedThreads.unread ?? []).length,
    mentioned: counts?.mentioned ?? (cachedThreads.mentioned ?? []).length,
    pinned: counts?.pinned ?? (cachedThreads.pinned ?? []).length,
    saved: counts?.saved ?? (cachedThreads.saved ?? []).length,
    urgent: counts?.urgent ?? (cachedThreads.urgent ?? []).length,
    noReply: counts?.noReply ?? (cachedThreads.noReply ?? []).length,
    needsTask: counts?.needsTask ?? (cachedThreads.needsTask ?? []).length,
    unacked: counts?.unacked ?? (cachedThreads.unacked ?? []).length,
    resolved: counts?.resolved ?? (cachedThreads.resolved ?? []).length,
  };
  const cancelQueuedEntry = (entryId: string) => {
    removeQueuedThreadMutation(entryId);
    const nextQueue = readQueuedThreadMutations();
    setPendingEntries(nextQueue);
    setPendingCount(nextQueue.length);
  };
  const clearOutbox = () => {
    clearQueuedThreadMutations();
    setPendingEntries([]);
    setPendingCount(0);
    setFailedFlushCount(0);
  };
  const changeTab = (next: Tab) => {
    setTab(next);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  };
  const empty = emptyCopy[tab];
  const activeFilters = [
    authorId && 'author',
    mentionedUserId && '@staff',
    category && category.toLowerCase(),
    status !== 'ACTIVE' && status.toLowerCase(),
    hasAttachment && 'files',
    hasTask && 'tasks',
    dateFrom && 'from',
    dateTo && 'to',
    health && health.toLowerCase().replace('_', ' '),
  ].filter(Boolean);
  const clearFilters = () => {
    setAuthorId('');
    setMentionedUserId('');
    setCategory('');
    setStatus('ACTIVE');
    setHasAttachment('');
    setHasTask('');
    setDateFrom('');
    setDateTo('');
    setHealth('');
  };

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <PageHeader title="Threads" subtitle="Store conversations" />
        <div className="mb-3">
          <label className="relative block">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-secondary text-[20px]">search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages"
              className="w-full h-12 pl-11 pr-4 bg-surface-white border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary"
            />
          </label>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="min-h-11 rounded-[--radius-lg] bg-surface-white text-on-surface-secondary font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
            Filters
            {activeFilters.length > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-on-brand">{activeFilters.length}</span>}
          </button>
          {canManage && (
            <button
              onClick={() => router.push('/hub/threads/inbox')}
              className="min-h-11 rounded-[--radius-lg] bg-warning/10 text-warning font-bold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">inbox</span>
              Inbox
            </button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={String(filter)} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{filter}</span>
            ))}
            <button onClick={clearFilters} className="rounded-full bg-surface-white px-3 py-1 text-xs font-bold text-on-surface-secondary">Clear</button>
          </div>
        )}
        {filtersOpen && (
          <div className="mb-3 rounded-[--radius-lg] bg-surface-white p-3 shadow-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Any Category</option>
                <option value="GENERAL">General</option>
                <option value="URGENT">Urgent</option>
                <option value="MAINTENANCE">Fix</option>
                <option value="INVENTORY">Stock</option>
                <option value="OTHER">Other</option>
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="ACTIVE">Active</option>
                <option value="RESOLVED">Done</option>
                <option value="ANY">Any Status</option>
              </select>
              <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Any Author</option>
                {(mentionTargets?.users || []).map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
              </select>
              <select value={mentionedUserId} onChange={(event) => setMentionedUserId(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Any Mention</option>
                {(mentionTargets?.users || []).map((user) => <option key={user.id} value={user.id}>@{user.fullName}</option>)}
              </select>
              <select value={hasAttachment} onChange={(event) => setHasAttachment(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Files: Any</option>
                <option value="yes">Has Files</option>
                <option value="no">No Files</option>
              </select>
              <select value={hasTask} onChange={(event) => setHasTask(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Tasks: Any</option>
                <option value="yes">Has Task</option>
                <option value="no">No Task</option>
              </select>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold" />
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold" />
            </div>
            {canManage && (
              <select value={health} onChange={(event) => setHealth(event.target.value)} className="h-11 w-full rounded-[--radius-lg] border border-outline bg-surface px-3 text-sm font-bold">
                <option value="">Health: Any</option>
                <option value="URGENT">Urgent</option>
                <option value="NO_REPLY">No Reply</option>
                <option value="NEEDS_TASK">Needs Task</option>
                <option value="UNACKED">Unacked</option>
              </select>
            )}
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto bg-surface-cream rounded-[--radius-lg] p-1">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`min-h-12 min-w-[92px] rounded-lg px-2 text-center text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1 ${
                tab === key
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'text-on-surface-secondary hover:bg-surface-creamest'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{icon}</span>
              <span>{label}</span>
              {tabCounts[key] > 0 && <span className="text-[10px] font-extrabold opacity-85">{tabCounts[key]}</span>}
            </button>
          ))}
        </div>
        {(usingCache || pendingCount > 0 || isFlushing || failedFlushCount > 0) && (
          <div className="mt-3 rounded-[--radius-lg] bg-warning/10 px-4 py-3 text-sm font-bold text-warning flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">{isFlushing ? 'sync' : 'cloud_off'}</span>
            <button
              onClick={() => setOutboxOpen(!outboxOpen)}
              className="flex-1 text-left"
            >
              {usingCache
                ? 'Showing saved threads'
                : isFlushing
                  ? 'Sending saved thread updates...'
                  : failedFlushCount > 0
                    ? `${pendingCount} update${pendingCount === 1 ? '' : 's'} still waiting. We will retry.`
                    : `${pendingCount} thread update${pendingCount === 1 ? '' : 's'} saved on this phone`}
            </button>
          </div>
        )}
        {outboxOpen && pendingEntries.length > 0 && (
          <div className="mt-2 rounded-[--radius-lg] bg-surface-white p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-on-surface">Outbox</p>
              <div className="flex gap-2">
                <button onClick={() => window.dispatchEvent(new Event('online'))} className="min-h-9 rounded-[--radius-lg] bg-success/10 px-3 text-xs font-bold text-success">Retry</button>
                <button onClick={clearOutbox} className="min-h-9 rounded-[--radius-lg] bg-error/10 px-3 text-xs font-bold text-error">Clear</button>
              </div>
            </div>
            {pendingEntries.map((entry) => (
              <div key={entry.id} className="min-h-11 rounded-[--radius-lg] bg-surface px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-warning">{entry.type === 'CREATE' ? 'add_comment' : entry.type === 'REPLY' ? 'reply' : entry.type === 'REACT' ? 'thumb_up' : 'done_all'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-on-surface">{entry.type.replace('_', ' ').toLowerCase()}</p>
                  <p className="text-xs text-on-surface-secondary">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => cancelQueuedEntry(entry.id)} className="w-9 h-9 rounded-full bg-surface-white text-on-surface-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
        {(counts?.unread || 0) > 0 && (
          <button
            onClick={() => markAllRead.mutate({})}
            disabled={markAllRead.isPending}
            className="mt-3 w-full min-h-11 rounded-[--radius-lg] bg-success/10 text-success font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">done_all</span>
            Mark All Read
          </button>
        )}
      </section>

      <section className="px-5 pb-24 space-y-3">
        {isLoading && !threads ? (
          <PageSkeleton variant="task-list" />
        ) : threads && threads.length > 0 ? (
          threads.map((thread: any) => (
            <ThreadCard
              key={thread.id}
              title={thread.title}
              author={thread.author.fullName}
              category={thread.category}
              preview={thread.preview}
              lastSender={thread.lastSender?.fullName}
              messageCount={thread._count.messages}
              attachmentCount={thread.attachmentCount}
              unreadCount={thread.unreadCount}
              isPinned={thread.isPinned}
              isResolved={thread.isResolved}
              isMentioned={thread.isMentioned}
              isSaved={thread.isSaved}
              isFollowing={thread.isFollowing}
              updatedAt={formatThreadDate(thread.lastMessageAt || thread.updatedAt)}
              onClick={() => router.push(`/hub/threads/${thread.id}?from=${tab}`)}
            />
          ))
        ) : (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
          />
        )}
      </section>

      <button
        type="button"
        aria-label="Create thread"
        onClick={() => router.push(`/hub/threads/create?from=${tab}`)}
        className="fixed right-6 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-lg transition-all duration-200 active:scale-90"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}

export default function ThreadsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="task-list" />}>
      <ThreadsContent />
    </Suspense>
  );
}
