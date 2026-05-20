'use client';

import { useMemo, useState } from 'react';
import { PageHeader, PageSkeleton } from '@superplus/ui';
import { trpc } from '@/lib/trpc-client';

type StatusFilter = 'ACTIVE' | 'EXPIRED' | 'ALL';
type PriorityFilter = 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'NORMAL';

type FormState = {
  id?: string;
  title: string;
  body: string;
  priority: 'CRITICAL' | 'IMPORTANT' | 'NORMAL';
  expiresAt: string;
  broadcast: boolean;
};

const emptyForm: FormState = {
  title: '',
  body: '',
  priority: 'NORMAL',
  expiresAt: '',
  broadcast: false,
};

const priorityStyle: Record<string, string> = {
  CRITICAL: 'bg-brand text-on-brand',
  IMPORTANT: 'bg-warning/20 text-warning',
  NORMAL: 'bg-surface text-on-surface-secondary',
};

function formatDate(value?: Date | string | null) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInput(value?: Date | string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function expiryFromInput(value: string) {
  if (!value) return null;
  return new Date(`${value}T23:59:59`);
}

export default function AdminAnnouncementsPage() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<StatusFilter>('ACTIVE');
  const [priority, setPriority] = useState<PriorityFilter>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState('');
  const { data: me } = trpc.users.me.useQuery();
  const { data: announcements, isLoading } = trpc.announcements.listAdmin.useQuery({
    status,
    priority: priority === 'ALL' ? undefined : priority,
  });

  const isOwner = me?.role === 'OWNER';
  const create = trpc.announcements.create.useMutation({
    onSuccess: () => {
      setNotice('Announcement posted');
      setForm(emptyForm);
      setFormOpen(false);
      utils.announcements.invalidate();
      utils.notifications.invalidate();
    },
  });
  const update = trpc.announcements.update.useMutation({
    onSuccess: () => {
      setNotice('Announcement updated');
      setForm(emptyForm);
      setFormOpen(false);
      utils.announcements.invalidate();
      utils.notifications.invalidate();
    },
  });
  const expire = trpc.announcements.expire.useMutation({
    onSuccess: () => {
      setNotice('Announcement expired');
      utils.announcements.invalidate();
    },
  });

  const error = create.error?.message || update.error?.message || expire.error?.message;
  const busy = create.isPending || update.isPending;
  const activeCount = useMemo(() => announcements?.filter((item: any) => !item.expiresAt || new Date(item.expiresAt) >= new Date()).length ?? 0, [announcements]);

  const submit = () => {
    const payload = {
      title: form.title,
      body: form.body,
      priority: form.priority,
      broadcast: isOwner ? form.broadcast : false,
      expiresAt: expiryFromInput(form.expiresAt),
    };
    if (form.id) update.mutate({ id: form.id, ...payload });
    else create.mutate(payload);
  };

  const startEdit = (announcement: any) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      priority: announcement.priority,
      expiresAt: toDateInput(announcement.expiresAt),
      broadcast: !announcement.storeId,
    });
    setFormOpen(true);
    setNotice('');
  };

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle={`${activeCount} active notice${activeCount === 1 ? '' : 's'}`}
        action={(
          <button
            onClick={() => { setForm(emptyForm); setFormOpen(true); setNotice(''); }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand px-5 font-bold text-on-brand"
          >
            <span className="material-symbols-outlined">campaign</span>
            New Announcement
          </button>
        )}
      />

      {(notice || error) && (
        <div className={`mb-4 flex items-center gap-2 rounded-[--radius-lg] px-4 py-3 text-sm font-bold ${error ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
          <span className="material-symbols-outlined text-[20px]">{error ? 'error' : 'check_circle'}</span>
          {error || notice}
        </div>
      )}

      {formOpen && (
        <section className="mb-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-on-surface">{form.id ? 'Edit Announcement' : 'New Announcement'}</h2>
              <p className="text-sm text-on-surface-secondary">Critical notices require staff acknowledgement.</p>
            </div>
            <button onClick={() => { setFormOpen(false); setForm(emptyForm); }} className="flex h-10 w-10 items-center justify-center rounded-[--radius-lg] bg-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px]">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Announcement title"
              className="h-14 rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-on-surface placeholder:text-on-surface-secondary focus:border-primary focus:outline-none"
            />
            <select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as FormState['priority'] })}
              className="h-14 rounded-[--radius-lg] border-2 border-outline bg-surface px-4 font-bold text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              className="h-14 rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none"
            />
            <textarea
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="What should staff know?"
              rows={4}
              className="rounded-[--radius-lg] border-2 border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-secondary focus:border-primary focus:outline-none lg:col-span-3"
            />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {isOwner ? (
              <button
                onClick={() => setForm({ ...form, broadcast: !form.broadcast })}
                className={`flex min-h-12 items-center gap-2 rounded-[--radius-lg] px-4 font-bold ${form.broadcast ? 'bg-navy text-on-navy' : 'bg-surface text-on-surface-secondary'}`}
              >
                <span className="material-symbols-outlined">{form.broadcast ? 'public' : 'store'}</span>
                {form.broadcast ? 'All stores' : 'My store'}
              </button>
            ) : (
              <div className="flex min-h-12 items-center gap-2 rounded-[--radius-lg] bg-surface px-4 text-sm font-bold text-on-surface-secondary">
                <span className="material-symbols-outlined text-[20px]">store</span>
                Store announcement
              </div>
            )}
            <button
              onClick={submit}
              disabled={busy || !form.title.trim() || !form.body.trim()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand px-5 font-bold text-on-brand disabled:opacity-50"
            >
              <span className={`material-symbols-outlined ${busy ? 'animate-spin' : ''}`}>{busy ? 'progress_activity' : 'send'}</span>
              {form.id ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </section>
      )}

      <section className="mb-4 rounded-[--radius-lg] bg-surface-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="grid grid-cols-3 gap-2">
            {(['ACTIVE', 'EXPIRED', 'ALL'] as StatusFilter[]).map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`min-h-11 rounded-[--radius-lg] text-sm font-bold ${status === item ? 'bg-navy text-on-navy' : 'bg-surface text-on-surface-secondary'}`}>
                {item === 'ACTIVE' ? 'Active' : item === 'EXPIRED' ? 'Expired' : 'All'}
              </button>
            ))}
          </div>
          <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)} className="h-11 rounded-[--radius-lg] border-2 border-outline bg-surface px-3 font-bold text-on-surface focus:border-primary focus:outline-none">
            <option value="ALL">All priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="IMPORTANT">Important</option>
            <option value="NORMAL">Normal</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <PageSkeleton variant="task-list" />
      ) : (
        <section className="space-y-3">
          {announcements && announcements.length > 0 ? announcements.map((announcement: any) => {
            const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < new Date();
            return (
              <article key={announcement.id} className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${priorityStyle[announcement.priority]}`}>{announcement.priority}</span>
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-on-surface-secondary">{announcement.audience}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${isExpired ? 'bg-outline/20 text-on-surface-secondary' : 'bg-success/10 text-success'}`}>{isExpired ? 'Expired' : 'Active'}</span>
                    </div>
                    <h2 className="text-lg font-extrabold text-on-surface">{announcement.title}</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-secondary">{announcement.body}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-outline">
                      <span>By {announcement.author.fullName}</span>
                      <span>Posted {formatDate(announcement.createdAt)}</span>
                      <span>Expires {formatDate(announcement.expiresAt)}</span>
                      <span>Read {announcement.receiptSummary.read} / {announcement.receiptSummary.target}</span>
                      {announcement.priority === 'CRITICAL' && (
                        <span className="text-brand">Ack {announcement.receiptSummary.acknowledged} / {announcement.receiptSummary.target}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(announcement)}
                      disabled={!announcement.canManage}
                      className="flex min-h-11 items-center gap-2 rounded-[--radius-lg] bg-surface px-4 text-sm font-bold text-on-surface disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                      Edit
                    </button>
                    {!isExpired && (
                      <button
                        onClick={() => expire.mutate({ id: announcement.id })}
                        disabled={!announcement.canManage || expire.isPending}
                        className="flex min-h-11 items-center gap-2 rounded-[--radius-lg] bg-error/10 px-4 text-sm font-bold text-error disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[20px]">archive</span>
                        Expire
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="rounded-[--radius-lg] bg-surface-white p-8 text-center text-on-surface-secondary shadow-sm">
              <span className="material-symbols-outlined mb-2 block text-[40px] text-outline">campaign</span>
              <p className="font-bold">No announcements found</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
