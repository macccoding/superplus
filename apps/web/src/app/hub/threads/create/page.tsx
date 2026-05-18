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
    <div className="px-5 py-6">
      <button onClick={() => { if (window.history.length > 1) router.back(); else router.push('/hub/threads'); }} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm space-y-5">
        <h2 className="text-xl font-bold text-on-surface">New Thread</h2>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Topic</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this about?"
            className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2.5 rounded-[--radius-lg] text-xs font-bold transition-all duration-200 active:scale-95 ${
                  category === c
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-cream text-on-surface-secondary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start the conversation..."
            rows={4}
            className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
          />
        </div>

        <button
          onClick={() => create.mutate({ title, body, category })}
          disabled={!title.trim() || !body.trim() || create.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {create.isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Posting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">send</span>
              Start Thread
            </>
          )}
        </button>
      </div>
    </div>
  );
}
