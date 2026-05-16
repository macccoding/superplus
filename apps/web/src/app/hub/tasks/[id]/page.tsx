'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id });
  const pickup = trpc.tasks.pickup.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
  });
  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
  });

  if (isLoading) return <div className="p-4 text-center text-[#6B7280]">Loading...</div>;
  if (!task) return <div className="p-4 text-center text-[#6B7280]">Task not found</div>;

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#1A1A2E]">{task.title}</h2>
        {task.description && (
          <p className="text-[#6B7280] mt-2">{task.description}</p>
        )}

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Priority</span>
            <span className="font-medium">{task.priority}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Status</span>
            <span className="font-medium">{task.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Created by</span>
            <span className="font-medium">{task.createdBy.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Assigned to</span>
            <span className="font-medium">{task.assignedTo?.fullName || 'Unassigned'}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {!task.assignedToId && (
            <button
              onClick={() => pickup.mutate({ id: task.id })}
              className="w-full h-14 bg-[#1B3A5C] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Take This Task
            </button>
          )}
          {task.status === 'OPEN' && task.assignedToId && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
              className="w-full h-14 bg-[#F5A623] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Start Working
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'DONE' })}
              className="w-full h-14 bg-[#2ECC71] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
