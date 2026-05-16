'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const categories = ['GENERAL', 'URGENT', 'MAINTENANCE', 'INVENTORY', 'OTHER'] as const;

export default function CreateThreadPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');

  const create = trpc.threads.create.useMutation({
    onSuccess: (thread) => {
      utils.threads.invalidate();
      router.push(`/hub/threads/${thread.id}`);
    },
  });

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">New Thread</h2>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Topic</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this about?"
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded-[8px] text-xs font-medium ${
                  category === c ? 'bg-[#E31837] text-white' : 'bg-gray-100 text-[#6B7280]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start the conversation..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
          />
        </div>

        <button
          onClick={() => create.mutate({ title, body, category })}
          disabled={!title.trim() || !body.trim() || create.isPending}
          className="w-full h-14 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40 active:scale-95 transition-transform"
        >
          {create.isPending ? 'Posting...' : 'Start Thread'}
        </button>
      </div>
    </div>
  );
}
