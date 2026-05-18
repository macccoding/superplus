'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ChecklistsAdminPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: templates } = trpc.checklists.listTemplates.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newItems, setNewItems] = useState<{ label: string; isRequired: boolean }[]>([{ label: '', isRequired: true }]);

  const createTemplate = trpc.checklists.createTemplate.useMutation({
    onSuccess: () => { utils.checklists.invalidate(); setShowCreate(false); setNewName(''); setNewItems([{ label: '', isRequired: true }]); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Checklists</h1>
          <p className="text-on-surface-secondary mt-1">Manage closing checklist templates</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Template
        </button>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {templates?.map((t) => (
          <div key={t.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[--radius-lg] bg-brand/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-brand">checklist</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">{t.name}</h3>
                <p className="text-sm text-on-surface-secondary">{t._count.items} items</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/admin/checklists/${t.id}`)}
                className="px-4 py-2 bg-surface-cream rounded-lg text-sm font-medium text-on-surface-secondary hover:text-on-surface transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => router.push('/admin/checklists/submissions')}
                className="px-4 py-2 bg-surface-cream rounded-lg text-sm font-medium text-on-surface-secondary hover:text-on-surface transition-colors"
              >
                History
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-lg space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">New Checklist Template</h2>

            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name (e.g. Nightly Closing)"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
              autoFocus
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface">Checklist Items</label>
              {newItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={item.label}
                    onChange={(e) => { const copy = [...newItems]; copy[i].label = e.target.value; setNewItems(copy); }}
                    placeholder={`Item ${i + 1}`}
                    className="flex-1 h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-on-surface-secondary transition-colors"
                  />
                  {newItems.length > 1 && (
                    <button onClick={() => setNewItems(newItems.filter((_, j) => j !== i))} className="w-12 h-12 flex items-center justify-center text-error">
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setNewItems([...newItems, { label: '', isRequired: true }])}
                className="w-full h-10 border-2 border-dashed border-outline rounded-[--radius-lg] text-sm text-on-surface-secondary font-medium flex items-center justify-center gap-1 hover:border-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Item
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold active:scale-95 transition-all">Cancel</button>
              <button
                onClick={() => createTemplate.mutate({ name: newName, items: newItems.filter(i => i.label.trim()) })}
                disabled={!newName.trim() || !newItems.some(i => i.label.trim())}
                className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
              >Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
