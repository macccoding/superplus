'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: guide } = trpc.training.getGuide.useQuery({ id });
  const [form, setForm] = useState({ title: '', category: '', description: '', steps: [{ title: '', content: '' }] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (guide && !loaded) {
      setForm({
        title: guide.title,
        category: guide.category,
        description: guide.description || '',
        steps: guide.steps.map((s: any) => ({ title: s.title, content: s.content })),
      });
      setLoaded(true);
    }
  }, [guide, loaded]);

  const update = trpc.training.updateGuide.useMutation({
    onSuccess: () => router.push('/admin/training'),
  });

  if (!guide) return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
      </button>

      <h1 className="text-3xl font-extrabold text-on-surface mb-8">Edit Guide</h1>

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-[--shadow-card] max-w-2xl space-y-5">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Guide title" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none text-on-surface" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none text-on-surface" />

        <div className="space-y-3">
          <label className="text-sm font-semibold text-on-surface">Steps</label>
          {form.steps.map((step, i) => (
            <div key={i} className="bg-surface rounded-[--radius-lg] p-4 space-y-2 border border-outline">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold">{i + 1}</span>
                <input value={step.title} onChange={(e) => { const s = [...form.steps]; s[i].title = e.target.value; setForm({ ...form, steps: s }); }} placeholder="Step title" className="flex-1 h-10 px-3 bg-surface-white border border-outline rounded-[--radius-sm] text-sm focus:border-brand focus:outline-none" />
                {form.steps.length > 1 && <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })} className="text-error"><span className="material-symbols-outlined text-[18px]">close</span></button>}
              </div>
              <textarea value={step.content} onChange={(e) => { const s = [...form.steps]; s[i].content = e.target.value; setForm({ ...form, steps: s }); }} placeholder="Instructions..." rows={2} className="w-full px-3 py-2 bg-surface-white border border-outline rounded-[--radius-sm] text-sm resize-none focus:border-brand focus:outline-none" />
            </div>
          ))}
          <button onClick={() => setForm({ ...form, steps: [...form.steps, { title: '', content: '' }] })} className="w-full h-10 border-2 border-dashed border-outline rounded-[--radius-lg] text-sm text-on-surface-secondary font-medium flex items-center justify-center gap-1 hover:border-brand transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>Add Step
          </button>
        </div>

        <button
          onClick={() => update.mutate({ id, title: form.title, category: form.category, description: form.description || undefined, steps: form.steps.filter(s => s.title && s.content) })}
          disabled={!form.title || update.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all shadow-md"
        >
          {update.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
