'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function AdminTrainingPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: guides } = trpc.training.listGuides.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', description: '', steps: [{ title: '', content: '' }] });

  const create = trpc.training.createGuide.useMutation({
    onSuccess: () => { utils.training.invalidate(); setShowCreate(false); setForm({ title: '', category: '', description: '', steps: [{ title: '', content: '' }] }); },
  });
  const togglePublish = trpc.training.togglePublish.useMutation({ onSuccess: () => utils.training.invalidate() });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Training Guides</h1>
          <p className="text-on-surface-variant mt-1">Create step-by-step procedures</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="h-12 px-5 bg-primary text-on-primary font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-md">
          <span className="material-symbols-outlined text-[20px]">add</span>New Guide
        </button>
      </div>

      <div className="space-y-3">
        {guides?.map((g: any) => (
          <div key={g.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary">menu_book</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">{g.title}</h3>
                <p className="text-sm text-on-surface-variant">{g.category} · {g._count.steps} steps</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => togglePublish.mutate({ id: g.id })} className={`px-3 py-1.5 rounded-full text-xs font-bold ${g.isPublished ? 'bg-success/10 text-success' : 'bg-outline/10 text-outline'}`}>
                {g.isPublished ? 'Published' : 'Draft'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-lg space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">New Training Guide</h2>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Guide title" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g., Food Safety, Opening)" className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface placeholder:text-outline" />

            <div className="space-y-3">
              <label className="text-sm font-medium text-on-surface">Steps</label>
              {form.steps.map((step, i) => (
                <div key={i} className="bg-surface-container-low rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold">{i + 1}</span>
                    <input value={step.title} onChange={(e) => { const steps = [...form.steps]; steps[i].title = e.target.value; setForm({ ...form, steps }); }} placeholder="Step title" className="flex-1 h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none" />
                    {form.steps.length > 1 && <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })} className="text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>}
                  </div>
                  <textarea value={step.content} onChange={(e) => { const steps = [...form.steps]; steps[i].content = e.target.value; setForm({ ...form, steps }); }} placeholder="Instructions..." rows={2} className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-sm text-on-surface resize-none focus:border-primary focus:outline-none" />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, steps: [...form.steps, { title: '', content: '' }] })} className="w-full h-10 border-2 border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant font-medium flex items-center justify-center gap-1 hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>Add Step
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-14 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold active:scale-95 transition-all">Cancel</button>
              <button onClick={() => create.mutate({ title: form.title, category: form.category, description: form.description || undefined, steps: form.steps.filter(s => s.title && s.content) })} disabled={!form.title || !form.category || !form.steps.some(s => s.title && s.content)} className="flex-1 h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all shadow-md">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
