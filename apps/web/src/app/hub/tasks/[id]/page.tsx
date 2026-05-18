'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const priorityConfig: Record<string, { color: string; label: string }> = {
  URGENT: { color: 'text-brand', label: 'Urgent' },
  HIGH: { color: 'text-warning', label: 'High' },
  NORMAL: { color: 'text-on-surface-secondary', label: 'Normal' },
  LOW: { color: 'text-on-surface-secondary', label: 'Low' },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: task, isLoading, isError } = trpc.tasks.getById.useQuery({ id });
  const pickup = trpc.tasks.pickup.useMutation({ onSuccess: () => utils.tasks.invalidate() });
  const updateStatus = trpc.tasks.updateStatus.useMutation({ onSuccess: () => utils.tasks.invalidate() });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    );
  }
  if (!task || isError) return (
    <div className="px-5 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-[48px] text-on-surface-secondary mb-3">search_off</span>
        <p className="text-on-surface-secondary">Task not found</p>
      </div>
    </div>
  );

  const p = priorityConfig[task.priority] || priorityConfig.NORMAL;

  return (
    <div className="px-5 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${p.color}`}>{p.label}</span>
          <span className="text-xs text-on-surface-secondary">·</span>
          <span className="text-xs text-on-surface-secondary">{task.createdAt.toLocaleDateString()}</span>
        </div>

        <h2 className="text-xl font-bold text-on-surface">{task.title}</h2>
        {task.description && (
          <p className="text-on-surface-secondary mt-2 leading-relaxed">{task.description}</p>
        )}

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

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {!task.assignedToId && (
            <button
              onClick={() => pickup.mutate({ id: task.id })}
              className="w-full h-14 bg-navy text-on-navy font-bold rounded-[--radius-lg] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">front_hand</span>
              Take This Task
            </button>
          )}
          {task.status === 'OPEN' && task.assignedToId && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
              className="w-full h-14 bg-warning/20 text-warning font-bold rounded-[--radius-lg] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Start Working
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'DONE' })}
              className="w-full h-14 bg-success text-white font-bold rounded-[--radius-lg] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
