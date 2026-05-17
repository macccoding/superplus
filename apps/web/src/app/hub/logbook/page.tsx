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
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Logbook</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          {new Date().toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </section>

      <section className="px-[--spacing-container] pb-24 space-y-3">
        {entries && entries.length > 0 ? (
          entries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              body={entry.body}
              author={entry.author.fullName}
              category={entry.category}
              isFlagged={entry.isFlagged}
              createdAt={entry.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            />
          ))
        ) : (
          <EmptyState
            icon="edit_note"
            title="No entries today"
            description="Add a note for the record"
          />
        )}
      </section>

      {/* Bottom sheet form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-lowest w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-xl font-bold text-on-surface">New Log Entry</h3>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline resize-none transition-colors"
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    category === c
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => setIsFlagged(!isFlagged)}>
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isFlagged ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                {isFlagged && <span className="material-symbols-outlined text-on-primary text-[16px]">check</span>}
              </div>
              <span className="text-sm font-medium text-on-surface">Flag for manager attention</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate({ body, category, isFlagged })}
                disabled={!body.trim() || create.isPending}
                className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-tertiary-container text-on-tertiary-container shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
