'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, PageSkeleton } from '@superplus/ui';

const statusOptions = [
  { value: '', label: 'All active' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'Working' },
  { value: 'NEEDS_HELP', label: 'Needs Help' },
  { value: 'IN_REVIEW', label: 'Review' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

const priorityOptions = [
  { value: '', label: 'Any priority' },
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

const statusStyle: Record<string, string> = {
  OPEN: 'bg-surface-cream text-on-surface-secondary',
  IN_PROGRESS: 'bg-brand-light/10 text-brand',
  NEEDS_HELP: 'bg-warning/15 text-warning',
  IN_REVIEW: 'bg-navy/10 text-navy',
  DONE: 'bg-success/10 text-success',
  CANCELLED: 'bg-outline/10 text-on-surface-secondary',
};

function toStatusLabel(status: string) {
  return statusOptions.find((option) => option.value === status)?.label ?? status.replaceAll('_', ' ');
}

function toDate(value: string) {
  return value ? new Date(`${value}T17:00:00`) : undefined;
}

function toInputDate(value?: Date | string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function csvToIds(value: string | null) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export default function AdminTasksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const lastQueryRef = useRef(currentQuery);
  const isUpdatingUrlRef = useRef(false);
  const utils = trpc.useUtils();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [due, setDue] = useState(searchParams.get('due') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [chip, setChip] = useState(searchParams.get('chip') || '');
  const [scope, setScope] = useState(searchParams.get('scope') || 'ALL');
  const [selected, setSelected] = useState<string[]>(() => csvToIds(searchParams.get('selected')));
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editOriginalAssigneeId, setEditOriginalAssigneeId] = useState('');
  const [notice, setNotice] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    assignedToId: '',
    priority: 'NORMAL',
    category: '',
    workArea: '',
    assetLabel: '',
    dueDate: '',
    reviewRequired: false,
    requireCompletionNote: false,
    requireCompletionPhoto: false,
    storeId: '',
  });
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Cleaning');
  const [templateRecurrence, setTemplateRecurrence] = useState('weekly');
  const [templateChecklist, setTemplateChecklist] = useState('');
  const [templateReview, setTemplateReview] = useState(false);
  const [templateNote, setTemplateNote] = useState(false);
  const [templatePhoto, setTemplatePhoto] = useState(false);
  const [templateAssignee, setTemplateAssignee] = useState('');
  const [templateDueDate, setTemplateDueDate] = useState('');

  const listInput = useMemo(() => ({
    status: status || undefined,
    priority: priority || undefined,
    due: due || undefined,
    search: search.trim() || undefined,
    scope,
    includeClosed: status === 'DONE' || status === 'CANCELLED',
    take: 150,
  }) as any, [status, priority, due, search, scope]);

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery(listInput);
  const { data: users } = trpc.tasks.assignableUsers.useQuery({ scope });
  const { data: templates } = trpc.tasks.listTemplates.useQuery({ scope });
  const exportCsv = trpc.tasks.exportCsv.useQuery({ status: status || undefined, due: due || undefined, search: search || undefined, scope } as any, { enabled: false });
  const bulkUpdate = trpc.tasks.bulkUpdate.useMutation({
    onSuccess: () => {
      setNotice(`Updated ${selected.length} selected task${selected.length === 1 ? '' : 's'}`);
      setSelected([]);
      setBulkAssignee('');
      setBulkDueDate('');
      setBulkPriority('');
      setBulkStatus('');
      utils.tasks.invalidate();
    },
  });
  const updateTask = trpc.tasks.updateDetails.useMutation({ onSuccess: () => utils.tasks.invalidate() });
  const reassignTask = trpc.tasks.reassign.useMutation({ onSuccess: () => utils.tasks.invalidate() });
  const sendDueReminders = trpc.tasks.sendDueReminders.useMutation({
    onSuccess: (result) => setNotice(result.count ? `Sent ${result.count} due reminder${result.count === 1 ? '' : 's'}` : 'No new due reminders to send'),
  });
  const createFromTemplate = trpc.tasks.createFromTemplate.useMutation({
    onSuccess: () => {
      setNotice('Task created from template');
      utils.tasks.invalidate();
    },
  });
  const updateTemplate = trpc.tasks.updateTemplate.useMutation({
    onSuccess: () => {
      setNotice('Template archived');
      utils.tasks.listTemplates.invalidate();
    },
  });
  const createTemplate = trpc.tasks.createTemplate.useMutation({
    onSuccess: () => {
      setNotice('Template saved');
      setTemplateTitle('');
      setTemplateChecklist('');
      utils.tasks.listTemplates.invalidate();
    },
  });

  const openCount = tasks?.filter((task) => !['DONE', 'CANCELLED'].includes(task.status)).length ?? 0;
  const helpCount = tasks?.filter((task) => task.status === 'NEEDS_HELP').length ?? 0;
  const overdueCount = tasks?.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && !['DONE', 'CANCELLED'].includes(task.status)).length ?? 0;
  const hasBulkChange = !!(bulkAssignee || bulkDueDate || bulkPriority || bulkStatus);
  const activeStores = stores ?? [];
  const selectedStoreId = scope === 'ALL' ? '' : scope;
  const isAllStores = scope === 'ALL';
  const activeFilterSummary = [
    status && `Status: ${toStatusLabel(status)}`,
    priority && `Priority: ${priorityOptions.find((option) => option.value === priority)?.label}`,
    due && `Due: ${due.toLowerCase()}`,
    search && `Search: ${search}`,
    chip && `Chip: ${chip}`,
    scope && scope !== 'ALL' && `Store: ${activeStores.find((store: any) => store.id === scope)?.name ?? 'Selected store'}`,
  ].filter(Boolean).join(' · ') || 'All active work';
  const adminReturnTo = `${pathname}${currentQuery ? `?${currentQuery}` : ''}`;

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (due) params.set('due', due);
    if (search.trim()) params.set('search', search.trim());
    if (chip) params.set('chip', chip);
    if (scope && scope !== 'ALL') params.set('scope', scope);
    if (selected.length) params.set('selected', selected.join(','));
    const nextQuery = params.toString();
    if (nextQuery !== currentQuery) {
      lastQueryRef.current = nextQuery;
      isUpdatingUrlRef.current = true;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [status, priority, due, search, chip, scope, selected, currentQuery, pathname, router]);

  useEffect(() => {
    if (isUpdatingUrlRef.current) {
      if (currentQuery === lastQueryRef.current) isUpdatingUrlRef.current = false;
      return;
    }
    if (currentQuery === lastQueryRef.current) return;
    lastQueryRef.current = currentQuery;
    setStatus(searchParams.get('status') || '');
    setPriority(searchParams.get('priority') || '');
    setDue(searchParams.get('due') || '');
    setSearch(searchParams.get('search') || '');
    setChip(searchParams.get('chip') || '');
    setScope(searchParams.get('scope') || 'ALL');
    setSelected(csvToIds(searchParams.get('selected')));
  }, [currentQuery, searchParams]);

  useEffect(() => {
    if (scope !== 'ALL' || activeStores.length !== 1) return;
    setScope(activeStores[0].id);
  }, [activeStores, scope]);

  useEffect(() => {
    setTemplateAssignee('');
  }, [scope]);

  useEffect(() => {
    if (!tasks) return;
    const visibleIds = new Set(tasks.map((task) => task.id));
    setSelected((current) => current.filter((id) => visibleIds.has(id)));
  }, [tasks]);

  const clearSelectionForFilterChange = () => setSelected([]);

  const toggleSelected = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const applyChip = (chip: 'overdue' | 'help' | 'review' | 'unassigned' | 'maintenance' | 'trucking') => {
    setChip(chip);
    clearSelectionForFilterChange();
    setPriority('');
    if (chip === 'overdue') { setStatus(''); setDue('OVERDUE'); setSearch(''); }
    if (chip === 'help') { setStatus('NEEDS_HELP'); setDue(''); setSearch(''); }
    if (chip === 'review') { setStatus('IN_REVIEW'); setDue(''); setSearch(''); }
    if (chip === 'unassigned') { setStatus('OPEN'); setDue(''); setSearch(''); }
    if (chip === 'maintenance') { setStatus(''); setDue(''); setSearch('Maintenance'); }
    if (chip === 'trucking') { setStatus(''); setDue(''); setSearch('Truck'); }
  };

  const startEdit = (task: any) => {
    setEditingId(task.id);
    setEditOriginalAssigneeId(task.assignedToId || '');
    setEditForm({
      title: task.title,
      description: task.description || '',
      assignedToId: task.assignedToId || '',
      priority: task.priority,
      category: task.category || '',
      workArea: task.workArea || '',
      assetLabel: task.assetLabel || '',
      dueDate: toInputDate(task.dueDate),
      reviewRequired: task.reviewRequired,
      requireCompletionNote: task.requireCompletionNote,
      requireCompletionPhoto: task.requireCompletionPhoto,
      storeId: task.storeId,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateTask.mutateAsync({
      id: editingId,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      priority: editForm.priority as any,
      category: editForm.category.trim() || null,
      workArea: editForm.workArea.trim() || null,
      assetLabel: editForm.assetLabel.trim() || null,
      dueDate: editForm.dueDate ? toDate(editForm.dueDate) : null,
      reviewRequired: editForm.reviewRequired,
      requireCompletionNote: editForm.requireCompletionNote,
      requireCompletionPhoto: editForm.requireCompletionPhoto,
      scope,
    });
    if (editForm.assignedToId !== editOriginalAssigneeId) {
      await reassignTask.mutateAsync({ id: editingId, assignedToId: editForm.assignedToId || null, scope });
    }
    setNotice('Task saved');
    setEditingId('');
    setEditOriginalAssigneeId('');
  };

  const applyBulkUpdate = () => {
    if (selected.length === 0) return;
    if (!hasBulkChange) return;
    const payload: any = {
      ids: selected,
      dueDate: bulkDueDate ? toDate(bulkDueDate) : undefined,
      priority: bulkPriority || undefined,
      status: bulkStatus || undefined,
      scope,
    };
    if (bulkAssignee) payload.assignedToId = bulkAssignee === '__UNASSIGN__' ? null : bulkAssignee;
    bulkUpdate.mutate(payload);
  };

  const downloadCsv = async () => {
    const result = await exportCsv.refetch();
    if (!result.data) return;
    const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'superplus-tasks.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Manager view for assignments, help, due work, and templates"
        action={(
        <Link href="/hub/tasks/create" className="h-12 px-5 bg-brand text-on-brand rounded-[--radius-lg] font-bold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined">add_task</span>
          New Task
        </Link>
        )}
      />

      {(notice || bulkUpdate.error || updateTask.error || reassignTask.error || sendDueReminders.error || createTemplate.error || createFromTemplate.error || updateTemplate.error) && (
        <div className={`mb-5 rounded-[--radius-lg] px-4 py-3 text-sm font-bold flex items-center gap-2 ${
          bulkUpdate.error || updateTask.error || reassignTask.error || sendDueReminders.error || createTemplate.error || createFromTemplate.error || updateTemplate.error
            ? 'bg-error/10 text-error'
            : 'bg-success/10 text-success'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {bulkUpdate.error || updateTask.error || reassignTask.error || sendDueReminders.error || createTemplate.error || createFromTemplate.error || updateTemplate.error ? 'error' : 'check_circle'}
          </span>
          {bulkUpdate.error?.message ||
            updateTask.error?.message ||
            reassignTask.error?.message ||
            sendDueReminders.error?.message ||
            createTemplate.error?.message ||
            createFromTemplate.error?.message ||
            updateTemplate.error?.message ||
            notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon="assignment" label="Open Work" value={openCount} tone="navy" />
        <StatCard icon="support_agent" label="Need Help" value={helpCount} tone="warning" />
        <StatCard icon="event_busy" label="Overdue" value={overdueCount} tone="brand" />
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select value={scope} onChange={(e) => { clearSelectionForFilterChange(); setScope(e.target.value); }} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none">
            {activeStores.length !== 1 && <option value="ALL">All Stores</option>}
            {activeStores.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <input value={search} onChange={(e) => { clearSelectionForFilterChange(); setChip(''); setSearch(e.target.value); }} placeholder="Search tasks..." className="h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none md:col-span-2" />
          <select value={status} onChange={(e) => { clearSelectionForFilterChange(); setChip(''); setStatus(e.target.value); }} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={priority} onChange={(e) => { clearSelectionForFilterChange(); setChip(''); setPriority(e.target.value); }} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none">
            {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={due} onChange={(e) => { clearSelectionForFilterChange(); setChip(''); setDue(e.target.value); }} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none">
            <option value="">Any due date</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Today</option>
            <option value="UPCOMING">Upcoming</option>
          </select>
        </div>

        <div className="mt-3 rounded-[--radius-lg] bg-surface px-4 py-3 text-sm font-bold text-on-surface-secondary">
          Showing: <span className="text-on-surface">{activeFilterSummary}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'overdue', label: 'Overdue' },
            { key: 'help', label: 'Needs Help' },
            { key: 'review', label: 'Review' },
            { key: 'unassigned', label: 'Unassigned' },
            { key: 'maintenance', label: 'Maintenance' },
            { key: 'trucking', label: 'Trucking' },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => applyChip(chip.key as any)}
              className={`min-h-10 px-3 rounded-[--radius-lg] text-sm font-bold ${
                (chip.key === 'overdue' && due === 'OVERDUE') ||
                (chip.key === 'help' && status === 'NEEDS_HELP') ||
                (chip.key === 'review' && status === 'IN_REVIEW') ||
                (chip.key === 'unassigned' && status === 'OPEN') ||
                (chip.key === 'maintenance' && search === 'Maintenance') ||
                (chip.key === 'trucking' && search === 'Truck')
                  ? 'bg-navy text-on-navy'
                  : 'bg-surface-cream text-on-surface'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            <button onClick={downloadCsv} className="h-11 px-4 rounded-[--radius-lg] bg-surface-cream text-on-surface font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export
            </button>
            <button onClick={() => sendDueReminders.mutate({ scope })} className="h-11 px-4 rounded-[--radius-lg] bg-warning/15 text-warning font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
              Remind Due
            </button>
          </div>
          <p className="text-sm font-bold text-on-surface-secondary">{selected.length ? `${selected.length} selected` : 'Select rows for bulk changes'}</p>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 rounded-[--radius-lg] bg-surface p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-on-surface">Bulk change selected tasks</p>
              <button onClick={() => setSelected([])} className="h-9 px-3 rounded-[--radius-lg] bg-surface-white text-sm font-bold text-on-surface-secondary">
                Clear
              </button>
            </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <select value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} className="h-11 min-w-0 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm">
              <option value="">Keep assignee</option>
              <option value="__UNASSIGN__">Unassign selected</option>
              {users?.map((user: any) => <option key={user.id} value={user.id}>{user.fullName}{isAllStores ? ` · ${user.store?.name ?? 'Store'}` : ''}</option>)}
            </select>
            <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} className="h-11 min-w-0 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm" />
            <select value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)} className="h-11 min-w-0 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm">
              {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-11 min-w-0 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm">
              <option value="">Keep status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">Working</option>
              <option value="NEEDS_HELP">Need Help</option>
              <option value="CANCELLED">Cancel</option>
            </select>
            <button
              disabled={selected.length === 0 || !hasBulkChange || bulkUpdate.isPending}
              onClick={applyBulkUpdate}
              className="h-11 px-4 rounded-[--radius-lg] bg-navy text-on-navy font-bold disabled:opacity-40"
            >
              Apply {selected.length || ''}
            </button>
          </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4">
              <PageSkeleton variant="task-list" />
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div className="divide-y divide-outline/20">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleSelected(task.id)} className="mt-1">
                    <span className={`material-symbols-outlined ${selected.includes(task.id) ? 'text-brand' : 'text-on-surface-secondary'}`}>
                      {selected.includes(task.id) ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                  </button>
                  <Link href={`/hub/tasks/${task.id}?from=admin&returnTo=${encodeURIComponent(adminReturnTo)}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`${statusStyle[task.status] || statusStyle.OPEN} px-2 py-0.5 rounded-full text-xs font-bold`}>{toStatusLabel(task.status)}</span>
                      <span className="text-xs font-bold text-on-surface-secondary">{task.priority}</span>
                      {task.dueDate && <span className="text-xs text-on-surface-secondary">Due {task.dueDate.toLocaleDateString()}</span>}
                    </div>
                    <p className="font-bold text-on-surface truncate">{task.title}</p>
                    <p className="text-xs text-on-surface-secondary mt-1">
                      {task.store?.name ? `${task.store.name} · ` : ''}{task.assignedTo?.fullName || 'Unassigned'} · {task.category || 'No category'}{task.workArea ? ` · ${task.workArea}` : ''}
                    </p>
                  </Link>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-on-surface-secondary">
                    <span>{task._count.updates} notes</span>
                    <span>{task._count.checklistItems} steps</span>
                    <span>{task._count.attachments} files</span>
                  </div>
                  <button onClick={() => startEdit(task)} className="h-10 px-3 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-secondary">assignment</span>
              <p className="text-on-surface-secondary mt-2">No tasks match these filters</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {editingId && (
            <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
              <h2 className="font-bold text-on-surface mb-3">Edit Task</h2>
              <div className="space-y-3">
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg]" />
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Details" rows={3} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] resize-none" />
                <select value={editForm.assignedToId} onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })} className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg]">
                  <option value="">Unassigned</option>
                  {users?.filter((user: any) => !editForm.storeId || user.storeId === editForm.storeId).map((user: any) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg]">
                    {priorityOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} className="h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg]" />
                </div>
                <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="Category" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg]" />
                <input value={editForm.workArea} onChange={(e) => setEditForm({ ...editForm, workArea: e.target.value })} placeholder="Work area" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg]" />
                <input value={editForm.assetLabel} onChange={(e) => setEditForm({ ...editForm, assetLabel: e.target.value })} placeholder="Asset, truck, equipment" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg]" />
                {[
                  ['reviewRequired', 'Review required'],
                  ['requireCompletionNote', 'Note required'],
                  ['requireCompletionPhoto', 'Photo proof by supervisor'],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => setEditForm({ ...editForm, [key]: !editForm[key as keyof typeof editForm] } as any)} className="w-full min-h-11 px-3 rounded-[--radius-lg] bg-surface flex items-center justify-between">
                    <span className="text-sm font-bold">{label}</span>
                    <span className={`material-symbols-outlined ${editForm[key as keyof typeof editForm] ? 'text-success' : 'text-on-surface-secondary'}`}>{editForm[key as keyof typeof editForm] ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEditingId('')} className="h-12 rounded-[--radius-lg] bg-surface-cream font-bold">Cancel</button>
                  <button onClick={saveEdit} disabled={updateTask.isPending || reassignTask.isPending || !editForm.title.trim()} className="h-12 rounded-[--radius-lg] bg-brand text-on-brand font-bold disabled:opacity-40">Save</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
            <h2 className="font-bold text-on-surface mb-3">New Template</h2>
            {isAllStores && <p className="mb-3 rounded-[--radius-lg] bg-warning/10 p-3 text-sm font-bold text-warning">Choose one store to create or use templates.</p>}
            <div className="space-y-3">
              <input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Template name" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none" />
              <input value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} placeholder="Category" className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none" />
              <select value={templateRecurrence} onChange={(e) => setTemplateRecurrence(e.target.value)} className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none">
                <option value="">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <textarea value={templateChecklist} onChange={(e) => setTemplateChecklist(e.target.value)} placeholder="Checklist items, one per line" rows={4} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none resize-none" />
              {[
                { value: templateReview, set: setTemplateReview, label: 'Supervisor review' },
                { value: templateNote, set: setTemplateNote, label: 'Require note' },
                { value: templatePhoto, set: setTemplatePhoto, label: 'Photo proof by supervisor' },
              ].map((item) => (
                <button key={item.label} onClick={() => item.set(!item.value)} className="w-full min-h-11 px-3 rounded-[--radius-lg] bg-surface flex items-center justify-between">
                  <span className="text-sm font-bold">{item.label}</span>
                  <span className={`material-symbols-outlined ${item.value ? 'text-success' : 'text-on-surface-secondary'}`}>{item.value ? 'check_circle' : 'radio_button_unchecked'}</span>
                </button>
              ))}
              <button
                disabled={!templateTitle.trim() || createTemplate.isPending || isAllStores}
                onClick={() => createTemplate.mutate({
                  title: templateTitle,
                  scope,
                  category: templateCategory || undefined,
                  recurrenceRule: templateRecurrence || undefined,
                  reviewRequired: templateReview,
                  requireCompletionNote: templateNote,
                  requireCompletionPhoto: templatePhoto,
                  checklistItems: templateChecklist.split('\n').map((label) => label.trim()).filter(Boolean).map((label) => ({ label })),
                })}
                className="w-full h-12 bg-brand text-on-brand rounded-[--radius-lg] font-bold disabled:opacity-40"
              >
                Save Template
              </button>
            </div>
          </div>

          <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
            <h2 className="font-bold text-on-surface mb-3">Templates</h2>
            <div className="grid grid-cols-1 gap-2 mb-3">
              <select value={templateAssignee} onChange={(e) => setTemplateAssignee(e.target.value)} className="w-full h-11 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm">
                <option value="">Create unassigned</option>
                {users?.filter((user: any) => !selectedStoreId || user.storeId === selectedStoreId).map((user: any) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
              </select>
              <input type="date" value={templateDueDate} onChange={(e) => setTemplateDueDate(e.target.value)} className="w-full h-11 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] text-sm" />
            </div>
            <div className="space-y-2">
              {templates?.slice(0, 8).map((template) => (
                <div key={template.id} className="p-3 rounded-[--radius-lg] bg-surface">
                  <p className="text-sm font-bold text-on-surface">{template.title}</p>
                  <p className="text-xs text-on-surface-secondary mt-0.5">
                    {isAllStores && template.store?.name ? `${template.store.name} · ` : ''}{template.category || 'General'}{template.recurrenceRule ? ` · ${template.recurrenceRule}` : ''}{template.items.length ? ` · ${template.items.length} steps` : ''}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => createFromTemplate.mutate({ templateId: template.id, assignedToId: templateAssignee || undefined, dueDate: toDate(templateDueDate), scope })}
                      disabled={isAllStores}
                      className="h-10 rounded-[--radius-lg] bg-navy text-on-navy text-sm font-bold disabled:opacity-40"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => updateTemplate.mutate({ id: template.id, isActive: false, scope })}
                      disabled={isAllStores}
                      className="h-10 rounded-[--radius-lg] bg-surface-cream text-on-surface text-sm font-bold disabled:opacity-40"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
              {templates?.length === 0 && <p className="text-sm text-on-surface-secondary">No templates yet</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: 'brand' | 'navy' | 'warning' }) {
  const toneClass = tone === 'brand' ? 'bg-brand/10 text-brand' : tone === 'navy' ? 'bg-navy/10 text-navy' : 'bg-warning/15 text-warning';
  return (
    <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm flex items-center gap-3">
      <div className={`w-12 h-12 rounded-[--radius-lg] flex items-center justify-center ${toneClass}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-on-surface">{value}</p>
        <p className="text-sm text-on-surface-secondary">{label}</p>
      </div>
    </div>
  );
}
