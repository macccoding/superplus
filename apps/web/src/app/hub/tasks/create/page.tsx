'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, PageSkeleton } from '@superplus/ui';

const priorityOptions = [
  { key: 'LOW', label: 'Low' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'HIGH', label: 'High' },
  { key: 'URGENT', label: 'Urgent' },
] as const;

const categoryOptions = ['Cleaning', 'Stock', 'Maintenance', 'Delivery', 'Customer', 'Office'];
const workAreaOptions = ['Front', 'Back Store', 'Chill Room', 'Warehouse', 'Truck', 'Office'];
const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };
type SourceTab = 'mine' | 'available' | 'help' | 'done';

function validTab(value: string | null): SourceTab {
  if (value === 'available' || value === 'help' || value === 'done' || value === 'mine') return value;
  return 'mine';
}

function toDate(value: string) {
  return value ? new Date(`${value}T17:00:00`) : undefined;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const fromTab = validTab(searchParams.get('from'));
  const backHref = `/hub/tasks?tab=${fromTab}`;
  const canCreate = roleRank[session?.user?.role || 'STAFF'] >= 2;
  const { data: users } = trpc.tasks.assignableUsers.useQuery(undefined, { enabled: canCreate });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [category, setCategory] = useState('Cleaning');
  const [workArea, setWorkArea] = useState('');
  const [assetLabel, setAssetLabel] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reviewRequired, setReviewRequired] = useState(false);
  const [requireCompletionNote, setRequireCompletionNote] = useState(false);
  const [requireCompletionPhoto, setRequireCompletionPhoto] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      router.push(backHref);
    },
  });

  if (!session) {
    return (
      <div className="px-5 py-6">
        <PageSkeleton variant="task-detail" />
      </div>
    );
  }

  const submit = () => {
    const cleanChecklist = checklistItems.map((label) => label.trim()).filter(Boolean);
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: category || undefined,
      workArea: workArea || undefined,
      assetLabel: assetLabel.trim() || undefined,
      assignedToId: assignedToId || undefined,
      dueDate: toDate(dueDate),
      reviewRequired,
      requireCompletionNote,
      requireCompletionPhoto,
      checklistItems: cleanChecklist.length ? cleanChecklist.map((label) => ({ label })) : undefined,
    });
  };

  if (!canCreate) {
    return (
      <div className="px-5 py-6">
        <PageHeader title="New Task" backHref={backHref} backLabel="Back to Tasks" />
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm text-center">
          <span className="material-symbols-outlined text-brand text-[48px]">front_hand</span>
          <h2 className="text-xl font-bold text-on-surface mt-3">Ask a supervisor</h2>
          <p className="text-sm text-on-surface-secondary mt-2">Supervisors create tasks so staff can keep the workflow simple.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <PageHeader title="New Task" subtitle="Keep it short. Add details only where they help." backHref={backHref} backLabel="Back to Tasks" />

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Details</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Steps, location, or anything staff should know"
            rows={3}
            className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {priorityOptions.map((p) => (
              <button
                key={p.key}
                onClick={() => setPriority(p.key)}
                className={`py-3 rounded-[--radius-lg] text-xs font-bold transition-all duration-200 active:scale-95 ${
                  priority === p.key ? 'bg-brand text-on-brand shadow-sm' : 'bg-surface-cream text-on-surface-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-on-surface mb-2">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface">
              {categoryOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-on-surface mb-2">Area</span>
            <select value={workArea} onChange={(e) => setWorkArea(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface">
              <option value="">No area</option>
              {workAreaOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-on-surface mb-2">Assign to</span>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface">
              <option value="">Pick Up task</option>
              {users?.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-on-surface mb-2">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface" />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Asset or truck</label>
          <input value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} placeholder="Truck 2, freezer, aisle 4..." className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-on-surface">Completion rules</p>
          {[
            { checked: reviewRequired, set: setReviewRequired, label: 'Supervisor review' },
            { checked: requireCompletionNote, set: setRequireCompletionNote, label: 'Require note' },
            { checked: requireCompletionPhoto, set: setRequireCompletionPhoto, label: 'Require photo proof' },
          ].map((item) => (
            <button key={item.label} onClick={() => item.set(!item.checked)} className="w-full min-h-12 px-4 rounded-[--radius-lg] bg-surface flex items-center justify-between text-left">
              <span className="text-sm font-bold text-on-surface">{item.label}</span>
              <span className={`material-symbols-outlined ${item.checked ? 'text-success' : 'text-on-surface-secondary'}`}>{item.checked ? 'check_circle' : 'radio_button_unchecked'}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-on-surface">Checklist</label>
            <button onClick={() => setChecklistItems([...checklistItems, ''])} className="h-10 px-3 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface">
              Add item
            </button>
          </div>
          <div className="space-y-2">
            {checklistItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={item}
                  onChange={(e) => {
                    const next = [...checklistItems];
                    next[index] = e.target.value;
                    setChecklistItems(next);
                  }}
                  placeholder={`Step ${index + 1}`}
                  className="flex-1 h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
                />
                {checklistItems.length > 1 && (
                  <button onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== index))} className="w-12 h-12 rounded-[--radius-lg] bg-surface-cream text-on-surface-secondary">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!title.trim() || create.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {create.isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Creating...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">add_task</span>
              Create Task
            </>
          )}
        </button>
      </div>
    </div>
  );
}
