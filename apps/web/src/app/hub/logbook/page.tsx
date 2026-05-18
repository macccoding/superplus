'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { LogEntryCard, EmptyState } from '@superplus/ui';
import { useSession } from 'next-auth/react';

const categories = ['GENERAL', 'INCIDENT', 'HANDOVER', 'INVENTORY'] as const;
const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };

export default function LogbookPage() {
  const utils = trpc.useUtils();
  const { data: session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');
  const [isFlagged, setIsFlagged] = useState(false);

  const { data: entries, isLoading } = trpc.logbook.listByDate.useQuery();
  const canCreateTask = roleRank[session?.user?.role || 'STAFF'] >= 2;

  const create = trpc.logbook.create.useMutation({
    onSuccess: () => {
      setBody('');
      setShowForm(false);
      setIsFlagged(false);
      setCategory('GENERAL');
      utils.logbook.invalidate();
    },
  });
  const createTask = trpc.tasks.createFromSource.useMutation({ onSuccess: () => utils.tasks.invalidate() });

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Logbook</h2>
        <p className="text-sm text-on-surface-secondary mt-1">
          {new Date().toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </section>

      <section className="px-5 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : entries && entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <LogEntryCard
                body={entry.body}
                author={entry.author.fullName}
                category={entry.category}
                isFlagged={entry.isFlagged}
                createdAt={entry.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              />
              {canCreateTask && entry.isFlagged && (
                <button
                  onClick={() => createTask.mutate({
                    sourceType: 'LOGBOOK' as any,
                    sourceId: entry.id,
                    sourceLabel: entry.body.slice(0, 80),
                    title: `${entry.category.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} follow-up`,
                    description: entry.body,
                    category: 'Logbook',
                    priority: entry.category === 'INCIDENT' ? 'HIGH' as any : 'NORMAL' as any,
                  })}
                  className="w-full h-12 rounded-[--radius-lg] bg-navy/10 text-navy font-bold flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">add_task</span>
                  Make Task
                </button>
              )}
            </div>
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
          <div className="bg-surface-white w-full rounded-t-2xl border-t-2 border-surface-variant p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-xl font-bold text-on-surface">New Log Entry</h3>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2.5 rounded-[--radius-lg] text-xs font-bold transition-all duration-200 ${
                    category === c
                      ? 'bg-brand text-on-brand'
                      : 'bg-surface-cream text-on-surface-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => setIsFlagged(!isFlagged)}>
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isFlagged ? 'bg-brand border-primary' : 'border-outline'}`}>
                {isFlagged && <span className="material-symbols-outlined text-on-brand text-[16px]">check</span>}
              </div>
              <span className="text-sm font-medium text-on-surface">Flag for manager attention</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate({ body, category, isFlagged })}
                disabled={!body.trim() || create.isPending}
                className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
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
        className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-warning/20 text-warning shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
