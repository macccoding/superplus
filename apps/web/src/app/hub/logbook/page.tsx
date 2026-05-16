'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { LogEntryCard, EmptyState } from '@superplus/ui';

const categories = ['GENERAL', 'INCIDENT', 'HANDOVER', 'INVENTORY'] as const;

export default function LogbookPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');
  const [isFlagged, setIsFlagged] = useState(false);

  const { data: entries } = trpc.logbook.listByDate.useQuery();

  const create = trpc.logbook.create.useMutation({
    onSuccess: () => {
      setBody('');
      setShowForm(false);
      setIsFlagged(false);
      setCategory('GENERAL');
      utils.logbook.invalidate();
    },
  });

  return (
    <div>
      <div className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide">
          Today — {new Date().toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>

        {entries && entries.length > 0 ? (
          entries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              body={entry.body}
              author={entry.author.fullName}
              category={entry.category}
              isFlagged={entry.isFlagged}
              createdAt={entry.createdAt.toLocaleTimeString()}
            />
          ))
        ) : (
          <EmptyState
            icon="📓"
            title="No entries today"
            description="Add a note for the record"
          />
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-[#1A1A2E]">New Log Entry</h3>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
              autoFocus
            />

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

            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={isFlagged}
                onChange={(e) => setIsFlagged(e.target.checked)}
                className="w-5 h-5 rounded accent-[#E74C3C]"
              />
              <span className="text-sm font-medium text-[#1A1A2E]">Flag for manager attention</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-12 border-2 border-gray-200 rounded-[8px] text-[#6B7280] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate({ body, category, isFlagged })}
                disabled={!body.trim() || create.isPending}
                className="flex-1 h-12 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#F5A623] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
