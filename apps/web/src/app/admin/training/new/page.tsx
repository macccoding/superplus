'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function NewGuidePage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', category: '', description: '', steps: [{ title: '', content: '' }] });

  const create = trpc.training.createGuide.useMutation({
    onSuccess: () => router.push('/admin/training'),
  });

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>

      <h1 className="text-3xl font-extrabold text-on-surface mb-8">New Training Guide</h1>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-[--shadow-card] max-w-2xl space-y-5">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Guide title" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g., Food Safety)" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description (optional)" rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none" />

        <div className="space-y-3">
          <label className="text-sm font-semibold text-on-surface">Steps</label>
          {form.steps.map((step, i) => (
            <div key={i} className="bg-surface rounded-[--radius-lg] p-4 space-y-2 border border-outline">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold">{i + 1}</span>
                <input value={step.title} onChange={(e) => { const s = [...form.steps]; s[i].title = e.target.value; setForm({ ...form, steps: s }); }} placeholder="Step title" className="flex-1 h-10 px-3 bg-surface-white border border-outline rounded-[--radius-sm] text-sm focus:border-brand focus:outline-none" />
                {form.steps.length > 1 && <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })} className="text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>}
              </div>
              <textarea value={step.content} onChange={(e) => { const s = [...form.steps]; s[i].content = e.target.value; setForm({ ...form, steps: s }); }} placeholder="Instructions for this step..." rows={2} className="w-full px-3 py-2 bg-surface-white border border-outline rounded-[--radius-sm] text-sm resize-none focus:border-brand focus:outline-none" />
            </div>
          ))}
          <button onClick={() => setForm({ ...form, steps: [...form.steps, { title: '', content: '' }] })} className="w-full h-10 border-2 border-dashed border-outline rounded-[--radius-lg] text-sm text-on-surface-secondary font-medium flex items-center justify-center gap-1 hover:border-brand transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>Add Step
          </button>
        </div>

        <button
          onClick={() => create.mutate({ title: form.title, category: form.category, description: form.description || undefined, steps: form.steps.filter(s => s.title && s.content) })}
          disabled={!form.title || !form.category || !form.steps.some(s => s.title && s.content) || create.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all shadow-md"
        >
          {create.isPending ? 'Creating...' : 'Create Guide'}
        </button>
      </div>
    </div>
  );
}
