'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { cacheTaskDetail, queueTaskMutation, readCachedTaskDetail, readQueuedTaskMutations } from '@/lib/task-offline';
import { PageHeader, PageSkeleton } from '@superplus/ui';

const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };

const priorityConfig: Record<string, { color: string; label: string }> = {
  URGENT: { color: 'text-brand', label: 'Urgent' },
  HIGH: { color: 'text-warning', label: 'High' },
  NORMAL: { color: 'text-on-surface-secondary', label: 'Normal' },
  LOW: { color: 'text-on-surface-secondary', label: 'Low' },
};

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  OPEN: { bg: 'bg-surface-cream', text: 'text-on-surface-secondary', label: 'Open', icon: 'radio_button_unchecked' },
  IN_PROGRESS: { bg: 'bg-brand-light/10', text: 'text-brand', label: 'Working', icon: 'play_arrow' },
  NEEDS_HELP: { bg: 'bg-warning/15', text: 'text-warning', label: 'Needs Help', icon: 'support_agent' },
  IN_REVIEW: { bg: 'bg-navy/10', text: 'text-navy', label: 'Review', icon: 'rate_review' },
  DONE: { bg: 'bg-success/10', text: 'text-success', label: 'Done', icon: 'check_circle' },
  CANCELLED: { bg: 'bg-outline/10', text: 'text-on-surface-secondary', label: 'Cancelled', icon: 'cancel' },
};

const updateLabels: Record<string, { icon: string; label: string }> = {
  CREATED: { icon: 'add_task', label: 'Created' },
  NOTE: { icon: 'notes', label: 'Update' },
  HELP_REQUESTED: { icon: 'support_agent', label: 'Help requested' },
  HELP_RESOLVED: { icon: 'check_circle', label: 'Help resolved' },
  STATUS_CHANGED: { icon: 'sync_alt', label: 'Status changed' },
  REASSIGNED: { icon: 'person_add', label: 'Assignment' },
  COMPLETION: { icon: 'task_alt', label: 'Completed' },
  SUBMITTED_REVIEW: { icon: 'rate_review', label: 'Sent for review' },
  APPROVED: { icon: 'verified', label: 'Approved' },
  SENT_BACK: { icon: 'undo', label: 'Sent back' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled' },
  CHECKLIST_UPDATED: { icon: 'checklist', label: 'Checklist' },
  ATTACHMENT_ADDED: { icon: 'attach_file', label: 'Attachment' },
};
const staffTabs = new Set(['mine', 'available', 'help', 'done']);

function plainError(message?: string) {
  if (!message) return '';
  if (message.includes('TRPC') || message.includes('Unexpected')) return 'Something went wrong. Try again.';
  return message;
}

function backTarget(from: string | null, returnTo: string | null) {
  if (from === 'admin') {
    return {
      href: returnTo || '/admin/tasks',
      label: 'Back to Admin Tasks',
    };
  }
  const tab = from && staffTabs.has(from) ? from : 'mine';
  return {
    href: `/hub/tasks?tab=${tab}`,
    label: tab === 'available' ? 'Back to Pick Up' : tab === 'help' ? 'Back to Help' : tab === 'done' ? 'Back to Done' : 'Back to Tasks',
  };
}

function formatDue(dueDate?: Date | string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due < today) return { label: `Late: ${due.toLocaleDateString()}`, className: 'bg-error/10 text-error' };
  if (due >= today && due < tomorrow) return { label: 'Due Today', className: 'bg-warning/15 text-warning' };
  return { label: `Due ${due.toLocaleDateString([], { month: 'short', day: 'numeric' })}`, className: 'bg-surface-cream text-on-surface-secondary' };
}

function sourceHref(type: string, entityId: string) {
  const hrefs: Record<string, string> = {
    TASK: `/hub/tasks/${entityId}`,
    INCIDENT: `/tools/incidents/${entityId}`,
    LOGBOOK: '/hub/logbook',
    CHECKLIST: '/tools/closing-checklist',
    PRODUCT: `/tools/product-lookup/${entityId}`,
    STOCK_OUT: '/tools/stock-out',
    EXPIRY_ALERT: '/tools/expiry-tracker',
    PURCHASE_ORDER: '/admin/purchase-orders',
    SOP_GUIDE: `/hub/learn/${entityId}`,
  };
  return hrefs[type] ?? null;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: liveTask, isLoading, isError } = trpc.tasks.getById.useQuery({ id });
  const [cachedTask, setCachedTask] = useState<any>(null);
  const [actionMessage, setActionMessage] = useState('');
  const canManage = roleRank[session?.user?.role || 'STAFF'] >= 2;
  const { data: users } = trpc.tasks.assignableUsers.useQuery(undefined, { enabled: canManage });

  const [note, setNote] = useState('');
  const [helpText, setHelpText] = useState('');
  const [finishNote, setFinishNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [completionSuccess, setCompletionSuccess] = useState(false);
  const from = searchParams.get('from');
  const returnTo = searchParams.get('returnTo');
  const back = backTarget(from, returnTo);

  useEffect(() => {
    setCachedTask(readCachedTaskDetail<any>(id)?.task ?? null);
  }, [id]);

  useEffect(() => {
    if (liveTask) cacheTaskDetail(liveTask);
  }, [liveTask]);

  const refresh = (message = '') => {
    setActionMessage(message);
    utils.tasks.invalidate();
  };

  const queueOfflineAction = (type: Parameters<typeof queueTaskMutation>[0], payload: unknown, message = 'Saved on this phone. It will send when task sync is available.') => {
    queueTaskMutation(type, payload);
    setActionMessage(`${message} ${readQueuedTaskMutations().length} waiting.`);
  };

  const runOrQueue = (type: Parameters<typeof queueTaskMutation>[0], payload: any, run: () => void) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueOfflineAction(type, payload);
      return;
    }
    run();
  };

  const pickup = trpc.tasks.pickup.useMutation({
    onSuccess: () => refresh('Task picked up'),
  });
  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onMutate: async (input) => {
      if (input.status !== 'IN_PROGRESS') return;
      await utils.tasks.getById.cancel({ id });
      const previous = utils.tasks.getById.getData({ id });
      utils.tasks.getById.setData({ id }, (old: any) => old ? { ...old, status: 'IN_PROGRESS' } : old);
      setActionMessage('Started task');
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.tasks.getById.setData({ id }, context.previous as any);
    },
    onSuccess: () => refresh('Started task'),
  });
  const addUpdate = trpc.tasks.addUpdate.useMutation({
    onMutate: () => setActionMessage('Update added'),
    onSuccess: () => { setNote(''); refresh('Update added'); },
  });
  const requestHelp = trpc.tasks.requestHelp.useMutation({
    onMutate: async () => {
      await utils.tasks.getById.cancel({ id });
      const previous = utils.tasks.getById.getData({ id });
      utils.tasks.getById.setData({ id }, (old: any) => old ? { ...old, status: 'NEEDS_HELP', helpRequestedAt: new Date() } : old);
      setActionMessage('Help requested');
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.tasks.getById.setData({ id }, context.previous as any);
    },
    onSuccess: () => { setHelpText(''); refresh('Help requested'); },
  });
  const resolveHelp = trpc.tasks.resolveHelp.useMutation({ onSuccess: () => refresh('Help marked resolved') });
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: (updated: any) => {
      setCompletionSuccess(true);
      refresh(updated.status === 'IN_REVIEW' ? 'Sent to supervisor' : 'Task marked done');
    },
  });
  const approve = trpc.tasks.approve.useMutation({ onSuccess: () => refresh('Task approved') });
  const sendBack = trpc.tasks.sendBack.useMutation({ onSuccess: () => { setReviewNote(''); refresh('Task sent back'); } });
  const reassign = trpc.tasks.reassign.useMutation({ onSuccess: () => refresh('Task reassigned') });
  const toggleChecklistItem = trpc.tasks.toggleChecklistItem.useMutation({
    onMutate: async (input) => {
      await utils.tasks.getById.cancel({ id });
      const previous = utils.tasks.getById.getData({ id });
      utils.tasks.getById.setData({ id }, (old: any) => old ? {
        ...old,
        checklistItems: old.checklistItems.map((item: any) => item.id === input.id ? { ...item, isDone: input.isDone } : item),
      } : old);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.tasks.getById.setData({ id }, context.previous as any);
    },
    onSuccess: () => refresh('Checklist updated'),
  });
  const addAttachment = trpc.tasks.addAttachment.useMutation({
    onSuccess: () => {
      setAttachmentUrl('');
      setAttachmentLabel('');
      refresh('Photo proof added');
    },
  });

  const task = liveTask ?? cachedTask;
  const usingCache = !liveTask && !!cachedTask && isError;

  if (isLoading && !task) {
    return <PageSkeleton variant="task-detail" />;
  }

  if (!task) return (
    <div className="px-5 py-6">
      <PageHeader title="Task not found" backHref={back.href} backLabel={back.label} />
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-[48px] text-on-surface-secondary mb-3">search_off</span>
        <p className="text-on-surface-secondary">Task not found</p>
      </div>
    </div>
  );

  const p = priorityConfig[task.priority] || priorityConfig.NORMAL;
  const s = statusConfig[task.status] || statusConfig.OPEN;
  const due = formatDue(task.dueDate);
  const canWork = canManage || task.assignedToId === session?.user?.id;
  const isClosed = task.status === 'DONE' || task.status === 'CANCELLED';
  const hasCompletionPhoto = task.attachments?.some((attachment: any) => attachment.type === 'IMAGE');
  const photoBlocked = task.requireCompletionPhoto && !hasCompletionPhoto;
  const checklistBlocked = task.checklistItems?.some((item: any) => item.isRequired && !item.isDone);
  const noteBlocked = task.requireCompletionNote && !finishNote.trim();
  const completionBlocker = checklistBlocked
    ? 'Finish the checklist first.'
    : noteBlocked
      ? 'Add a note before sending.'
      : photoBlocked
        ? 'Ask a supervisor to add photo proof.'
        : '';
  const canFinish = !completionBlocker;
  const mutationError =
    plainError(complete.error?.message) ||
    plainError(requestHelp.error?.message) ||
    plainError(addUpdate.error?.message) ||
    plainError(toggleChecklistItem.error?.message) ||
    plainError(addAttachment.error?.message) ||
    actionMessage;

  return (
    <div className="px-5 py-6 pb-40 md:pb-28">
      <PageHeader title="Task" backHref={back.href} backLabel={back.label} />

      {(usingCache || mutationError) && (
        <div className={`mb-4 rounded-[--radius-lg] px-4 py-3 text-sm font-bold flex items-center gap-2 ${usingCache || complete.error || requestHelp.error || addUpdate.error || toggleChecklistItem.error || addAttachment.error ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          <span className="material-symbols-outlined text-[20px]">{usingCache ? 'cloud_off' : complete.error || requestHelp.error || addUpdate.error || toggleChecklistItem.error || addAttachment.error ? 'info' : 'check_circle'}</span>
          {usingCache ? 'Showing saved task details' : mutationError}
        </div>
      )}

      <div className={`${s.bg} ${s.text} mb-4 rounded-[--radius-lg] px-4 py-3 flex items-center gap-3`}>
        <span className="material-symbols-outlined text-[26px]">{s.icon}</span>
        <div>
          <p className="text-sm font-extrabold">{s.label}</p>
          <p className="text-xs font-medium opacity-80">
            {task.status === 'IN_REVIEW'
              ? 'A supervisor needs to approve this task.'
              : task.status === 'NEEDS_HELP'
                ? 'A supervisor has been asked to help.'
                : task.status === 'IN_PROGRESS'
                  ? 'This task is being worked on.'
                  : task.status === 'DONE'
                    ? 'This task is complete.'
                    : task.status === 'CANCELLED'
                      ? 'This task was cancelled.'
                      : 'This task is ready to start.'}
          </p>
        </div>
      </div>

      {completionSuccess && (
        <div className="mb-4 rounded-[--radius-lg] bg-success/10 p-4 text-success">
          <p className="font-extrabold">{task.reviewRequired ? 'Sent to supervisor' : 'Task marked done'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={back.href} className="min-h-11 rounded-[--radius-lg] bg-surface-white px-3 py-2 text-center text-sm font-bold text-on-surface">
              Back to Tasks
            </Link>
            <Link href="/hub/tasks?tab=mine" className="min-h-11 rounded-[--radius-lg] bg-success px-3 py-2 text-center text-sm font-bold text-white">
              Next Task
            </Link>
          </div>
        </div>
      )}

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${p.color}`}>{p.label}</span>
          <span className={`${s.bg} ${s.text} px-2 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1`}>
            <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
            {s.label}
          </span>
          {due && <span className={`${due.className} px-2 py-1 rounded-full text-xs font-bold`}>{due.label}</span>}
        </div>

        <h2 className="text-xl font-bold text-on-surface">{task.title}</h2>
        {task.description && <p className="text-on-surface-secondary mt-2 leading-relaxed whitespace-pre-wrap">{task.description}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          {task.category && <span className="px-3 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">{task.category}</span>}
          {task.workArea && <span className="px-3 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">{task.workArea}</span>}
          {task.assetLabel && <span className="px-3 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">{task.assetLabel}</span>}
          {task.reviewRequired && <span className="px-3 py-1 rounded-full bg-navy/10 text-xs font-bold text-navy">Review required</span>}
          {task.requireCompletionNote && <span className="px-3 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">Note required</span>}
          {task.requireCompletionPhoto && <span className="px-3 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">Photo required</span>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-[--radius-lg] p-3">
            <span className="text-xs text-on-surface-secondary block mb-1">Created by</span>
            <span className="text-sm font-bold text-on-surface">{task.createdBy.fullName}</span>
          </div>
          <div className="bg-surface rounded-[--radius-lg] p-3">
            <span className="text-xs text-on-surface-secondary block mb-1">Assigned to</span>
            <span className={`text-sm font-bold ${task.assignedTo ? 'text-navy' : 'text-warning'}`}>
              {task.assignedTo?.fullName || 'Unassigned'}
            </span>
          </div>
        </div>

        {task.links.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase text-on-surface-secondary mb-2">Linked from</p>
            <div className="flex flex-wrap gap-2">
              {task.links.map((link: any) => {
                const href = sourceHref(link.type, link.entityId);
                const label = link.label || link.type.replaceAll('_', ' ').toLowerCase();
                const className = 'min-h-10 px-3 rounded-[--radius-lg] bg-navy/10 text-navy text-sm font-bold inline-flex items-center gap-2';
                return href ? (
                  <Link key={link.id} href={href} className={className}>
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    {label}
                  </Link>
                ) : (
                  <span key={link.id} className={className}>{label}</span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 hidden space-y-3 md:block">
          <PrimaryTaskActions
            task={task}
            canWork={canWork}
            isClosed={isClosed}
            pickup={() => pickup.mutate({ id: task.id })}
            start={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
            backHref={back.href}
          />
        </div>
      </div>

      {task.checklistItems.length > 0 && (
        <section className="mt-4 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
          <h3 className="font-bold text-on-surface mb-3">Checklist</h3>
          <div className="space-y-2">
            {task.checklistItems.map((item: any) => (
              <button
                key={item.id}
                onClick={() => canWork && !isClosed && runOrQueue('TOGGLE_CHECKLIST', { id: item.id, isDone: !item.isDone }, () => toggleChecklistItem.mutate({ id: item.id, isDone: !item.isDone }))}
                className="w-full min-h-12 px-3 py-2 rounded-[--radius-lg] bg-surface flex items-center gap-3 text-left disabled:opacity-60"
                disabled={!canWork || isClosed || toggleChecklistItem.isPending}
              >
                <span className={`material-symbols-outlined ${item.isDone ? 'text-success' : 'text-on-surface-secondary'}`}>{item.isDone ? 'check_circle' : 'radio_button_unchecked'}</span>
                <span className={`text-sm font-bold flex-1 ${item.isDone ? 'text-on-surface-secondary line-through' : 'text-on-surface'}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {canWork && !isClosed && (
        <section id="task-progress" className="mt-4 scroll-mt-20 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-on-surface">Progress</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a quick update..." rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface resize-none" />
          <button onClick={() => runOrQueue('ADD_UPDATE', { id, body: note }, () => addUpdate.mutate({ id, body: note }))} disabled={!note.trim() || addUpdate.isPending} className="w-full h-12 bg-surface-cream text-on-surface font-bold rounded-[--radius-lg] disabled:opacity-40 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">notes</span>
            Add Update
          </button>
        </section>
      )}

      {canWork && !isClosed && task.status !== 'NEEDS_HELP' && (
        <section id="task-help" className="mt-4 scroll-mt-20 bg-warning/10 rounded-[--radius-lg] p-5 space-y-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-warning">support_agent</span>
            Need help?
          </h3>
          <textarea value={helpText} onChange={(e) => setHelpText(e.target.value)} placeholder="What is blocking this task?" rows={2} className="w-full px-4 py-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] focus:border-warning focus:outline-none text-sm text-on-surface resize-none" />
          <button onClick={() => runOrQueue('REQUEST_HELP', { id, body: helpText }, () => requestHelp.mutate({ id, body: helpText }))} disabled={!helpText.trim() || requestHelp.isPending} className="w-full h-12 bg-warning text-white font-bold rounded-[--radius-lg] disabled:opacity-40 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">front_hand</span>
            Ask For Help
          </button>
        </section>
      )}

      {canManage && task.status === 'NEEDS_HELP' && (
        <section className="mt-4 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
          <button onClick={() => resolveHelp.mutate({ id, body: 'Supervisor responded' })} className="w-full h-12 bg-success text-white font-bold rounded-[--radius-lg] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            Mark Helped
          </button>
        </section>
      )}

      {canWork && !isClosed && (task.status === 'IN_PROGRESS' || task.status === 'NEEDS_HELP') && (
        <section id="task-finish" className="mt-4 scroll-mt-20 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-on-surface">Finish task</h3>
          {(task.requireCompletionNote || task.reviewRequired) && (
            <textarea value={finishNote} onChange={(e) => setFinishNote(e.target.value)} placeholder="What was done?" rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface resize-none" />
          )}
          {completionBlocker && (
            <div className="rounded-[--radius-lg] bg-warning/10 p-3 text-sm font-bold text-warning flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              {completionBlocker}
            </div>
          )}
          <button onClick={() => runOrQueue('COMPLETE', { id, note: finishNote || undefined }, () => complete.mutate({ id, note: finishNote || undefined }))} disabled={complete.isPending || !canFinish} className="w-full h-14 bg-success text-white font-bold rounded-[--radius-lg] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
            <span className="material-symbols-outlined">{task.reviewRequired ? 'rate_review' : 'check_circle'}</span>
            {task.reviewRequired ? 'Send For Review' : 'Mark Done'}
          </button>
        </section>
      )}

      {task.status === 'IN_REVIEW' && !canManage && (
        <section className="mt-4 bg-navy/10 rounded-[--radius-lg] p-5 text-navy">
          <h3 className="font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">rate_review</span>
            Waiting Review
          </h3>
          <p className="text-sm mt-1">A supervisor will check this and mark it done.</p>
        </section>
      )}

      {canManage && task.status === 'IN_REVIEW' && (
        <section className="mt-4 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-on-surface">Supervisor review</h3>
          <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Optional note..." rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => sendBack.mutate({ id, body: reviewNote || 'Please fix and try again' })} className="h-12 bg-warning/20 text-warning font-bold rounded-[--radius-lg]">Send Back</button>
            <button onClick={() => approve.mutate({ id, body: reviewNote || undefined })} className="h-12 bg-success text-white font-bold rounded-[--radius-lg]">Approve</button>
          </div>
        </section>
      )}

      {canManage && !isClosed && (
        <section className="mt-4 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-on-surface">Supervisor controls</h3>
          <div className="flex gap-2">
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="min-w-0 flex-1 h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm">
              <option value="">Unassigned</option>
              {users?.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
            <button onClick={() => reassign.mutate({ id, assignedToId: assignedToId || null })} className="h-12 px-4 bg-navy text-on-navy font-bold rounded-[--radius-lg]">Assign</button>
          </div>
          {task.requireCompletionPhoto && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-on-surface">Photo proof</p>
              <input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Photo URL from upload" className="w-full h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm" />
              <input value={attachmentLabel} onChange={(e) => setAttachmentLabel(e.target.value)} placeholder="Short label" className="w-full h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm" />
              <button
                onClick={() => addAttachment.mutate({ id, type: 'IMAGE', url: attachmentUrl, label: attachmentLabel || 'Completion photo' })}
                disabled={!attachmentUrl.trim() || addAttachment.isPending}
                className="w-full h-12 bg-surface-cream text-on-surface font-bold rounded-[--radius-lg] disabled:opacity-40"
              >
                Add Photo Proof
              </button>
            </div>
          )}
          <button onClick={() => updateStatus.mutate({ id, status: 'CANCELLED', note: 'Cancelled by supervisor' })} className="w-full h-12 bg-error/10 text-error font-bold rounded-[--radius-lg]">
            Cancel Task
          </button>
        </section>
      )}

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-outline/40 bg-surface-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <PrimaryTaskActions
          task={task}
          canWork={canWork}
          isClosed={isClosed}
          pickup={() => pickup.mutate({ id: task.id })}
          start={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
          backHref={back.href}
          compact
        />
      </div>

      <section className="mt-4 bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
        <h3 className="font-bold text-on-surface mb-3">Updates</h3>
        {task.updates.length === 0 ? (
          <p className="text-sm text-on-surface-secondary">No updates yet</p>
        ) : (
          <div className="space-y-3">
            {task.updates.map((update: any) => {
              const meta = updateLabels[update.type] || updateLabels.NOTE;
              return (
                <div key={update.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-secondary">{meta.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-on-surface">{meta.label}</p>
                      <p className="text-[11px] text-on-surface-secondary shrink-0">{update.createdAt.toLocaleDateString()}</p>
                    </div>
                    <p className="text-xs text-on-surface-secondary">{update.author.fullName}</p>
                    {update.body && <p className="text-sm text-on-surface mt-1 whitespace-pre-wrap">{update.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function PrimaryTaskActions({
  task,
  canWork,
  isClosed,
  pickup,
  start,
  backHref,
  compact = false,
}: {
  task: any;
  canWork: boolean;
  isClosed: boolean;
  pickup: () => void;
  start: () => void;
  backHref: string;
  compact?: boolean;
}) {
  if (isClosed) {
    return (
      <Link href={backHref} className="flex h-12 items-center justify-center gap-2 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface">
        <span className="material-symbols-outlined text-[20px]">assignment</span>
        Back to Tasks
      </Link>
    );
  }

  if (!task.assignedToId && task.status === 'OPEN') {
    return (
      <button onClick={pickup} className="flex h-12 w-full items-center justify-center gap-2 rounded-[--radius-lg] bg-navy text-sm font-bold text-on-navy active:scale-[0.98]">
        <span className="material-symbols-outlined text-[20px]">front_hand</span>
        Take This Task
      </button>
    );
  }

  if (task.status === 'OPEN' && task.assignedToId && canWork) {
    return (
      <button onClick={start} className="flex h-12 w-full items-center justify-center gap-2 rounded-[--radius-lg] bg-warning text-sm font-bold text-white active:scale-[0.98]">
        <span className="material-symbols-outlined text-[20px]">play_arrow</span>
        Start
      </button>
    );
  }

  if (!canWork || (task.status !== 'IN_PROGRESS' && task.status !== 'NEEDS_HELP')) {
    return (
      <div className="flex h-12 items-center justify-center rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface-secondary">
        No action needed
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
      <a href="#task-progress" className="flex min-h-12 items-center justify-center gap-1 rounded-[--radius-lg] bg-surface-cream px-2 text-center text-sm font-bold text-on-surface">
        <span className="material-symbols-outlined text-[19px]">notes</span>
        Update
      </a>
      {task.status !== 'NEEDS_HELP' ? (
        <a href="#task-help" className="flex min-h-12 items-center justify-center gap-1 rounded-[--radius-lg] bg-warning px-2 text-center text-sm font-bold text-white">
          <span className="material-symbols-outlined text-[19px]">support_agent</span>
          Help
        </a>
      ) : (
        <div className="flex min-h-12 items-center justify-center gap-1 rounded-[--radius-lg] bg-warning/15 px-2 text-center text-sm font-bold text-warning">
          <span className="material-symbols-outlined text-[19px]">support_agent</span>
          Help
        </div>
      )}
      <a href="#task-finish" className="flex min-h-12 items-center justify-center gap-1 rounded-[--radius-lg] bg-success px-2 text-center text-sm font-bold text-white">
        <span className="material-symbols-outlined text-[19px]">{task.reviewRequired ? 'rate_review' : 'check_circle'}</span>
        {task.reviewRequired ? 'Review' : 'Done'}
      </a>
    </div>
  );
}
