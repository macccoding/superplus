'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function CreateTaskPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      router.push('/hub/tasks');
    },
  });

  return (
    <div className="px-[--spacing-container] py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-xl font-bold text-on-surface">New Task</h2>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra info..."
            rows={3}
            className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline resize-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`py-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                  priority === p
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => create.mutate({ title, description: description || undefined, priority })}
          disabled={!title.trim() || create.isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
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
