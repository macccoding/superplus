'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, PageSkeleton } from '@superplus/ui';
import { trpc } from '@/lib/trpc-client';

type AttentionItem = {
  id: string;
  sourceId: string;
  type: string;
  severity: 'danger' | 'warning' | 'info';
  icon: string;
  title: string;
  subtitle: string;
  storeId: string;
  storeName: string;
  href: string;
  action: 'REMIND' | 'OPEN' | 'CREATE_TASK' | 'ACKNOWLEDGE' | 'MARK_PULLED';
};

type RecentItem = {
  id: string;
  title: string;
  storeName: string;
  href: string;
  updatedAt: Date;
};

const severityStyle = {
  danger: 'border-l-error bg-error/5 text-error',
  warning: 'border-l-warning bg-warning/10 text-warning',
  info: 'border-l-navy bg-navy/5 text-navy',
};

const healthStyle = {
  danger: 'bg-error/10 text-error',
  warning: 'bg-warning/15 text-warning',
  good: 'bg-success/10 text-success',
};

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [scope, setScope] = useState(searchParams.get('scope') || 'ALL');
  const [days, setDays] = useState<1 | 7 | 30>((Number(searchParams.get('days')) as 1 | 7 | 30) || 7);
  const [taskDraft, setTaskDraft] = useState<AttentionItem | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [suggestionResponse, setSuggestionResponse] = useState('');
  const [notice, setNotice] = useState('');
  const detailType = searchParams.get('attentionType') || '';
  const detailSourceId = searchParams.get('sourceId') || '';
  const detailScope = searchParams.get('detailScope') || scope;

  const { data: me } = trpc.users.me.useQuery();
  const { data: stores } = trpc.stores.list.useQuery();
  const { data, isLoading, isError } = trpc.admin.summary.useQuery({ scope, days });
  const { data: attentionDetail } = trpc.admin.attentionDetail.useQuery(
    { scope: detailScope, type: detailType, sourceId: detailSourceId },
    { enabled: !!detailType && !!detailSourceId }
  );
  const { data: users } = trpc.users.list.useQuery({ scope: taskDraft?.storeId || scope }, { enabled: !!taskDraft });

  const remindDue = trpc.admin.sendDueReminders.useMutation({
    onSuccess: (result) => {
      setNotice(result.count ? `Sent ${result.count} due reminder${result.count === 1 ? '' : 's'}` : 'No reminders needed right now');
      utils.admin.invalidate();
      utils.tasks.invalidate();
    },
  });
  const respondSuggestion = trpc.admin.respondToSuggestion.useMutation({
    onSuccess: () => {
      setNotice('Suggestion response saved');
      setSuggestionResponse('');
      utils.admin.invalidate();
    },
  });
  const acknowledgeStockOut = trpc.admin.acknowledgeStockOut.useMutation({
    onSuccess: () => {
      setNotice('Stock-out acknowledged');
      utils.admin.invalidate();
      utils.stockOuts.invalidate();
    },
  });
  const markExpiryPulled = trpc.admin.markExpiryPulled.useMutation({
    onSuccess: () => {
      setNotice('Expiry alert marked pulled');
      utils.admin.invalidate();
      utils.expiryAlerts.invalidate();
    },
  });
  const createTask = trpc.admin.createTaskFromAttention.useMutation({
    onSuccess: () => {
      setNotice('Task created from attention item');
      setTaskDraft(null);
      setTaskTitle('');
      setTaskAssignee('');
      setTaskDueDate('');
      utils.admin.invalidate();
      utils.tasks.invalidate();
    },
  });

  const activeStores = stores ?? [];
  const generated = data?.generatedAt ? data.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  const topAttention = useMemo(() => data?.attention?.slice(0, 10) ?? [], [data]);
  const scopedHref = (href: string) => {
    if (scope === 'ALL') return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}scope=${encodeURIComponent(scope)}`;
  };

  useEffect(() => {
    if (scope !== 'ALL' || activeStores.length !== 1) return;
    setScope(activeStores[0].id);
  }, [activeStores, scope]);

  useEffect(() => {
    if (searchParams.get('days') || !me) return;
    setDays(me.role === 'OWNER' ? 7 : 1);
  }, [me, searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (scope && scope !== 'ALL') params.set('scope', scope); else params.delete('scope');
    if (days !== 7) params.set('days', String(days)); else params.delete('days');
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(next ? `/admin?${next}` : '/admin', { scroll: false });
  }, [days, router, scope, searchParams]);

  const openTaskDraft = (item: AttentionItem) => {
    setTaskDraft(item);
    setTaskTitle(item.type === 'MISSED_CHECKLIST' ? `Complete checklist: ${item.title}` : `Follow up: ${item.title}`);
    setTaskAssignee('');
    setTaskDueDate('');
  };

  const runAction = (item: AttentionItem) => {
    if (item.action === 'REMIND') remindDue.mutate({ scope: item.storeId });
    if (item.action === 'ACKNOWLEDGE') acknowledgeStockOut.mutate({ id: item.sourceId, scope: item.storeId });
    if (item.action === 'MARK_PULLED') markExpiryPulled.mutate({ id: item.sourceId, scope: item.storeId });
    if (item.action === 'CREATE_TASK') openTaskDraft(item);
  };

  const openAttention = (item: AttentionItem) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('attentionType', item.type);
    params.set('sourceId', item.sourceId);
    params.set('detailScope', item.storeId);
    router.push(`/admin?${params.toString()}`, { scroll: false });
  };

  const closeAttention = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('attentionType');
    params.delete('sourceId');
    params.delete('detailScope');
    router.push(params.toString() ? `/admin?${params.toString()}` : '/admin', { scroll: false });
  };

  if (isLoading) return <PageSkeleton variant="admin-tasks" />;

  if (isError || !data) {
    return (
      <div className="rounded-[--radius-lg] bg-error/10 p-5 text-error">
        <span className="material-symbols-outlined align-middle">error</span>
        <span className="ml-2 font-bold">Admin dashboard could not load.</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Operations"
        subtitle={`${data.scope.label} · refreshed ${generated}`}
        action={(
          <Link href="/hub/tasks/create" className="flex h-12 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand px-5 font-bold text-on-brand">
            <span className="material-symbols-outlined">add_task</span>
            New Task
          </Link>
        )}
      />

      {(notice || remindDue.error || acknowledgeStockOut.error || markExpiryPulled.error || createTask.error || respondSuggestion.error) && (
        <div className={`mb-5 flex items-center gap-2 rounded-[--radius-lg] px-4 py-3 text-sm font-bold ${
          remindDue.error || acknowledgeStockOut.error || markExpiryPulled.error || createTask.error || respondSuggestion.error ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {remindDue.error || acknowledgeStockOut.error || markExpiryPulled.error || createTask.error || respondSuggestion.error ? 'error' : 'check_circle'}
          </span>
          {remindDue.error?.message || acknowledgeStockOut.error?.message || markExpiryPulled.error?.message || createTask.error?.message || respondSuggestion.error?.message || notice}
        </div>
      )}

      <div className="mb-6 rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Store Scope</span>
            <select value={scope} onChange={(event) => setScope(event.target.value)} className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 font-bold text-on-surface focus:border-primary focus:outline-none">
              {(data.scope.isAllStores || activeStores.length !== 1) && <option value="ALL">All Stores</option>}
              {activeStores.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Window</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value) as 1 | 7 | 30)} className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 font-bold text-on-surface focus:border-primary focus:outline-none">
              <option value={1}>Today</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <button onClick={() => remindDue.mutate({ scope })} className="mt-5 flex h-12 items-center justify-center gap-2 rounded-[--radius-lg] bg-warning/15 px-4 font-bold text-warning">
            <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            Remind Due
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-on-surface">Today</h2>
            <p className="text-sm text-on-surface-secondary">Shift operating checks</p>
          </div>
          <span className="rounded-full bg-surface-cream px-3 py-1 text-xs font-bold text-on-surface-secondary">{data.todayOperations.checklistStatus.length} store view</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <TodayTile href={scopedHref(data.todayOperations.links.dueToday)} icon="today" label="Due Today" value={data.todayOperations.dueToday} />
          <TodayTile href={scopedHref(data.todayOperations.links.overdue)} icon="event_busy" label="Overdue" value={data.todayOperations.overdue} danger={data.todayOperations.overdue > 0} />
          <TodayTile href={data.todayOperations.links.incidents} icon="report_problem" label="Incidents" value={data.todayOperations.unresolvedIncidents} danger={data.todayOperations.unresolvedIncidents > 0} />
          <TodayTile href={scopedHref(data.todayOperations.links.unassigned)} icon="person_search" label="Unassigned" value={data.todayOperations.unassigned} danger={data.todayOperations.unassigned > 0} />
          <TodayTile href={scopedHref('/admin/tasks')} icon="groups" label="Overloaded" value={data.todayOperations.overloadedStaff} danger={data.todayOperations.overloadedStaff > 0} />
          <TodayTile href="/admin/checklists/submissions" icon="checklist" label="Checklists" value={data.todayOperations.checklistStatus.filter((item: any) => item.opening === 'missing' || item.closing === 'missing').length} danger={data.todayOperations.checklistStatus.some((item: any) => item.opening === 'missing' || item.closing === 'missing')} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.todayOperations.checklistStatus.slice(0, 4).map((item: any) => (
            <Link key={item.storeId} href={`/admin/stores/${item.storeId}/operations`} className="flex items-center justify-between rounded-[--radius-lg] bg-surface p-3 text-sm">
              <span className="font-bold text-on-surface">{item.storeName}</span>
              <span className="text-xs font-bold text-on-surface-secondary">Open {item.opening} · Close {item.closing}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi icon="priority_high" label="Needs Action" value={data.kpis.riskCount} tone="danger" href="/admin/activity" />
        <Kpi icon="event_busy" label="Overdue" value={data.kpis.overdueTasks} tone="danger" href={scopedHref('/admin/tasks?due=OVERDUE')} />
        <Kpi icon="support_agent" label="Need Help" value={data.kpis.helpTasks} tone="warning" href={scopedHref('/admin/tasks?status=NEEDS_HELP')} />
        <Kpi icon="rate_review" label="Review" value={data.kpis.reviewTasks} tone="navy" href={scopedHref('/admin/tasks?status=IN_REVIEW')} />
        <Kpi icon="task_alt" label="Done" value={data.kpis.completedTasks} tone="success" href={scopedHref('/admin/tasks?status=DONE')} />
        <Kpi icon="groups" label="Staff" value={data.kpis.staff} tone="neutral" href={scopedHref('/admin/people')} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-on-surface">Needs Attention</h2>
              <p className="text-sm text-on-surface-secondary">Highest-risk store work first</p>
            </div>
            <Link href="/admin/activity" className="flex min-h-11 items-center rounded-[--radius-lg] bg-surface-cream px-3 text-sm font-bold text-on-surface">View Feed</Link>
          </div>

          <div className="space-y-3">
            {topAttention.map((item: AttentionItem) => (
              <div key={item.id} className={`border-l-4 ${severityStyle[item.severity]} rounded-r-[--radius-lg] p-3`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button onClick={() => openAttention(item)} className="min-h-11 min-w-0 flex-1 rounded-[--radius-md] text-left">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="material-symbols-outlined text-[24px]">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-on-surface">{item.title}</p>
                        <p className="text-xs text-on-surface-secondary">{item.storeName} · {item.subtitle}</p>
                      </div>
                    </div>
                  </button>
                  <AttentionAction item={item} onRun={runAction} busy={remindDue.isPending || acknowledgeStockOut.isPending || markExpiryPulled.isPending} />
                </div>
              </div>
            ))}
            {topAttention.length === 0 && (
              <div className="flex items-center gap-3 rounded-[--radius-lg] bg-success/10 p-5 text-success">
                <span aria-hidden="true" className="material-symbols-outlined">check_circle</span>
                <span className="font-bold">All clear right now</span>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-extrabold text-on-surface">Workload</h2>
            <div className="mb-4 rounded-[--radius-lg] bg-surface p-4">
              <p className="text-3xl font-extrabold text-on-surface">{data.workload.unassigned}</p>
              <p className="text-sm text-on-surface-secondary">Unassigned active tasks</p>
            </div>
            <div className="space-y-2">
              {data.workload.overloaded.map((user: any) => (
                <Link key={user.id} href={`/admin/tasks?search=${encodeURIComponent(user.fullName)}`} className="flex items-center justify-between rounded-[--radius-lg] bg-surface p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-on-surface">{user.fullName}</span>
                    <span className="text-xs text-on-surface-secondary">{user.storeName}</span>
                  </span>
                  <span className="text-sm font-bold text-warning">{user.active} active</span>
                </Link>
              ))}
              {data.workload.overloaded.length === 0 && <p className="text-sm text-on-surface-secondary">No overloaded staff</p>}
            </div>
          </section>

          <section className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-extrabold text-on-surface">Shortcuts</h2>
            <div className="grid grid-cols-2 gap-2">
              {data.quickLinks.map((item: any) => (
                <Link key={item.href} href={scopedHref(item.href)} className="rounded-[--radius-lg] bg-surface p-3 active:scale-[0.98]">
                  <span className="material-symbols-outlined text-navy">{item.icon}</span>
                  <span className="mt-2 block text-sm font-bold text-on-surface">{item.label}</span>
                  <span className="text-xs font-bold text-on-surface-secondary">{item.badge} open</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-on-surface">Store Health</h2>
            <p className="text-sm text-on-surface-secondary">Sorted by operational risk</p>
          </div>
          <Link href="/admin/stores" className="rounded-[--radius-lg] bg-surface-cream px-3 py-2 text-sm font-bold text-on-surface">Stores</Link>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.storeHealth.map((store: any) => (
            <Link key={store.storeId} href={`/admin/stores/${store.storeId}/operations`} className="block rounded-[--radius-lg] bg-surface p-4 active:scale-[0.99]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-on-surface">{store.storeName}</p>
                  <p className="text-xs text-on-surface-secondary">{store.parish}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${healthStyle[store.status as keyof typeof healthStyle]}`}>
                  {store.status === 'good' ? 'Good' : store.status === 'danger' ? 'Urgent' : 'Watch'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniMetric label="Open" value={store.openTasks} />
                <MiniMetric label="Late" value={store.overdueTasks} danger={store.overdueTasks > 0} />
                <MiniMetric label="Help" value={store.helpTasks} danger={store.helpTasks > 0} />
                <MiniMetric label="Issues" value={store.openIncidents + store.stockOuts + store.expiryAlerts} danger={store.openIncidents + store.stockOuts + store.expiryAlerts > 0} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentList title="Recent Tasks" icon="assignment" items={data.recentActivity.tasks} />
        <RecentList title="Active Threads" icon="forum" items={data.recentActivity.threads} />
      </section>

      <section className="mt-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-navy">history</span>
          <h2 className="font-extrabold text-on-surface">Recent Admin Actions</h2>
        </div>
        <div className="space-y-2">
          {data.actionLog.map((action: any) => (
            <div key={action.id} className="flex items-center justify-between gap-3 rounded-[--radius-lg] bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">{action.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-on-surface-secondary">{action.actor?.fullName ?? 'Admin'} · {action.store?.name ?? data.scope.label} · {new Date(action.createdAt).toLocaleString()}</p>
              </div>
              {action.note && <span className="hidden max-w-[260px] truncate text-xs font-bold text-on-surface-secondary sm:inline">{action.note}</span>}
            </div>
          ))}
          {data.actionLog.length === 0 && <p className="text-sm text-on-surface-secondary">No admin actions logged yet</p>}
        </div>
      </section>

      {taskDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTaskDraft(null)}>
          <div className="w-full max-w-md space-y-4 rounded-[--radius-lg] bg-surface-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">Create Task</h2>
              <p className="mt-1 text-sm text-on-surface-secondary">{taskDraft.storeName} · {taskDraft.title}</p>
            </div>
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" aria-label="Task title" className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 focus:border-primary focus:outline-none" />
            <select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} aria-label="Assign task to" className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 focus:border-primary focus:outline-none">
              <option value="">Create unassigned</option>
              {users?.filter((user: any) => user.storeId === taskDraft.storeId).map((user: any) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
            <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} aria-label="Task due date" className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 focus:border-primary focus:outline-none" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setTaskDraft(null)} className="h-14 rounded-[--radius-lg] border-2 border-outline font-bold text-on-surface-secondary">Cancel</button>
              <button
                disabled={!taskTitle.trim() || createTask.isPending}
                onClick={() => createTask.mutate({
                  scope: taskDraft.storeId,
                  type: taskDraft.type,
                  sourceId: taskDraft.sourceId,
                  title: taskTitle,
                  assignedToId: taskAssignee || undefined,
                  dueDate: taskDueDate ? new Date(`${taskDueDate}T17:00:00`) : undefined,
                })}
                className="h-14 rounded-[--radius-lg] bg-brand font-bold text-on-brand disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {(detailType && detailSourceId) && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={closeAttention}>
          <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-surface-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline/30 p-5">
              <div>
                <h2 className="text-xl font-extrabold text-on-surface">Attention Detail</h2>
                <p className="text-sm text-on-surface-secondary">{detailType.replaceAll('_', ' ')}</p>
              </div>
              <button onClick={closeAttention} aria-label="Close attention detail" className="flex h-11 w-11 items-center justify-center rounded-[--radius-lg] bg-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {!attentionDetail ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-[32px] text-brand">progress_activity</span>
              </div>
            ) : (
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <div className="rounded-[--radius-lg] bg-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Source</p>
                  <p className="mt-1 text-lg font-extrabold text-on-surface">{attentionTitle(attentionDetail)}</p>
                  <p className="mt-1 text-sm text-on-surface-secondary">Linked tasks: {attentionDetail.linkedTaskCount}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {attentionDetail.validActions.canRemind && (
                    <button onClick={() => remindDue.mutate({ scope: attentionDetail.storeId })} className="h-12 rounded-[--radius-lg] bg-warning/15 font-bold text-warning">Remind Store</button>
                  )}
                  {attentionDetail.validActions.canAcknowledgeStockOut && (
                    <button onClick={() => acknowledgeStockOut.mutate({ id: attentionDetail.sourceId, scope: attentionDetail.storeId })} className="h-12 rounded-[--radius-lg] bg-navy font-bold text-on-navy">Acknowledge</button>
                  )}
                  {attentionDetail.validActions.canMarkExpiryPulled && (
                    <button onClick={() => markExpiryPulled.mutate({ id: attentionDetail.sourceId, scope: attentionDetail.storeId })} className="h-12 rounded-[--radius-lg] bg-success font-bold text-white">Mark Pulled</button>
                  )}
                  {attentionDetail.validActions.canCreateTask && (
                    <button onClick={() => openTaskDraft({
                      id: `${attentionDetail.type}-${attentionDetail.sourceId}`,
                      sourceId: attentionDetail.sourceId,
                      type: attentionDetail.type,
                      severity: 'warning',
                      icon: 'add_task',
                      title: attentionTitle(attentionDetail),
                      subtitle: 'Create follow-up',
                      storeId: attentionDetail.storeId,
                      storeName: attentionDetail.source.store?.name ?? 'Store',
                      href: '#',
                      action: 'CREATE_TASK',
                    })} className="h-12 rounded-[--radius-lg] bg-brand font-bold text-on-brand">Make Task</button>
                  )}
                  <Link href={`/admin/stores/${attentionDetail.storeId}/operations`} className="flex h-12 items-center justify-center rounded-[--radius-lg] bg-surface-cream font-bold text-on-surface">Store Ops</Link>
                </div>

                {attentionDetail.validActions.canRespondSuggestion && (
                  <div className="space-y-2 rounded-[--radius-lg] bg-surface p-3">
                    <textarea value={suggestionResponse} onChange={(event) => setSuggestionResponse(event.target.value)} placeholder="Write response" className="min-h-24 w-full rounded-[--radius-lg] border-2 border-outline bg-surface-white p-3 text-sm focus:border-primary focus:outline-none" />
                    <button
                      disabled={!suggestionResponse.trim() || respondSuggestion.isPending}
                      onClick={() => respondSuggestion.mutate({ id: attentionDetail.sourceId, response: suggestionResponse, status: 'REVIEWED', scope: attentionDetail.storeId })}
                      className="h-12 w-full rounded-[--radius-lg] bg-navy font-bold text-on-navy disabled:opacity-40"
                    >
                      Save Response
                    </button>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 font-extrabold text-on-surface">Linked Tasks</h3>
                  <div className="space-y-2">
                    {attentionDetail.linkedTasks.map((task: any) => (
                      <Link key={task.id} href={`/hub/tasks/${task.id}?from=admin`} className="block rounded-[--radius-lg] bg-surface p-3">
                        <p className="truncate text-sm font-bold text-on-surface">{task.title}</p>
                        <p className="text-xs text-on-surface-secondary">{task.assignedTo?.fullName ?? 'Unassigned'} · {task.status.replaceAll('_', ' ')}</p>
                      </Link>
                    ))}
                    {attentionDetail.linkedTasks.length === 0 && <p className="text-sm text-on-surface-secondary">No linked tasks yet</p>}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 font-extrabold text-on-surface">Action History</h3>
                  <div className="space-y-2">
                    {attentionDetail.recentActions.map((action: any) => (
                      <div key={action.id} className="rounded-[--radius-lg] bg-surface p-3">
                        <p className="text-sm font-bold text-on-surface">{action.action.replaceAll('_', ' ')}</p>
                        <p className="text-xs text-on-surface-secondary">{action.actor?.fullName ?? 'Admin'} · {new Date(action.createdAt).toLocaleString()}</p>
                        {action.note && <p className="mt-1 text-xs text-on-surface-secondary">{action.note}</p>}
                      </div>
                    ))}
                    {attentionDetail.recentActions.length === 0 && <p className="text-sm text-on-surface-secondary">No admin actions yet</p>}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin-tasks" />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function Kpi({ icon, label, value, tone, href }: { icon: string; label: string; value: number; tone: 'danger' | 'warning' | 'navy' | 'success' | 'neutral'; href?: string }) {
  const toneClass = tone === 'danger' ? 'bg-error/10 text-error' : tone === 'warning' ? 'bg-warning/15 text-warning' : tone === 'success' ? 'bg-success/10 text-success' : tone === 'navy' ? 'bg-navy/10 text-navy' : 'bg-surface-cream text-on-surface-secondary';
  const content = (
    <>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-[--radius-lg] ${toneClass}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-extrabold text-on-surface">{value}</p>
          <p className="text-xs font-bold text-on-surface-secondary">{label}</p>
        </div>
        {href && <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-secondary">chevron_right</span>}
      </div>
    </>
  );
  const className = "block rounded-[--radius-lg] bg-surface-white p-4 shadow-sm transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 hover:shadow-md";
  if (href) {
    return (
      <Link href={href} className={className} aria-label={`Open ${label}`}>
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
      {content}
    </div>
  );
}

function TodayTile({ href, icon, label, value, danger }: { href: string; icon: string; label: string; value: number; danger?: boolean }) {
  return (
    <Link href={href} className={`block rounded-[--radius-lg] p-3 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 ${danger ? 'bg-error/10 text-error' : 'bg-surface text-on-surface'}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{icon}</span>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-extrabold">{value}</p>
          <p className="text-xs font-bold text-on-surface-secondary">{label}</p>
        </div>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-secondary">chevron_right</span>
      </div>
    </Link>
  );
}

function attentionTitle(detail: any) {
  const source = detail?.source ?? {};
  return source.title || source.productName || source.name || source.orderNumber || source.body?.slice(0, 90) || detail?.type?.replaceAll('_', ' ') || 'Attention item';
}

function AttentionAction({ item, onRun, busy }: { item: AttentionItem; onRun: (item: AttentionItem) => void; busy: boolean }) {
  if (item.action === 'OPEN') {
    return <Link href={item.href} className="flex min-h-11 items-center rounded-[--radius-lg] bg-surface-white px-3 text-sm font-bold text-on-surface shadow-sm">Open</Link>;
  }
  const label = item.action === 'REMIND' ? 'Remind Store' : item.action === 'ACKNOWLEDGE' ? 'Acknowledge' : item.action === 'MARK_PULLED' ? 'Pulled' : 'Make Task';
  return (
    <button disabled={busy} onClick={() => onRun(item)} className="min-h-11 min-w-28 rounded-[--radius-lg] bg-surface-white px-3 text-sm font-bold text-on-surface shadow-sm disabled:opacity-50">
      {label}
    </button>
  );
}

function MiniMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-[--radius-md] bg-surface-white p-2">
      <p className={`text-lg font-extrabold ${danger ? 'text-error' : 'text-on-surface'}`}>{value}</p>
      <p className="text-[11px] font-bold text-on-surface-secondary">{label}</p>
    </div>
  );
}

function RecentList({ title, icon, items }: { title: string; icon: string; items: RecentItem[] }) {
  return (
    <div className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-navy">{icon}</span>
        <h2 className="font-extrabold text-on-surface">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-[--radius-lg] bg-surface p-3 active:scale-[0.99]">
            <p className="truncate text-sm font-bold text-on-surface">{item.title}</p>
            <p className="mt-0.5 text-xs text-on-surface-secondary">{item.storeName} · {new Date(item.updatedAt).toLocaleDateString()}</p>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-on-surface-secondary">No recent activity</p>}
      </div>
    </div>
  );
}
