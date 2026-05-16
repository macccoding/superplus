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
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">New Task</h2>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra info..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`py-2 rounded-[8px] text-xs font-medium transition-colors ${
                  priority === p
                    ? 'bg-[#E31837] text-white'
                    : 'bg-gray-100 text-[#6B7280]'
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
          className="w-full h-14 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40 active:scale-95 transition-transform"
        >
          {create.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
