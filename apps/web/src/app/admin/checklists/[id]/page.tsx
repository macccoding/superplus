'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function EditChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: template } = trpc.checklists.getTemplate.useQuery({ id });
  const [items, setItems] = useState<{ label: string; isRequired: boolean }[]>([]);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (template && !loaded) {
      setName(template.name);
      setItems(template.items.map(i => ({ label: i.label, isRequired: i.isRequired })));
      setLoaded(true);
    }
  }, [template, loaded]);

  const update = trpc.checklists.updateTemplate.useMutation({
    onSuccess: () => { utils.checklists.invalidate(); router.push('/admin/checklists'); },
  });

  function moveItem(index: number, direction: 'up' | 'down') {
    const newItems = [...items];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setItems(newItems);
  }

  if (!template) return <div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Checklists
      </button>

      <h1 className="text-3xl font-black text-on-surface mb-8">Edit Template</h1>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm max-w-2xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Template Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-on-surface transition-colors" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-on-surface">Items (drag to reorder)</label>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface-container-low rounded-xl p-3">
              <div className="flex flex-col">
                <button onClick={() => moveItem(i, 'up')} disabled={i === 0} className="text-outline disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">expand_less</span>
                </button>
                <button onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1} className="text-outline disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
              </div>
              <input
                value={item.label}
                onChange={(e) => { const copy = [...items]; copy[i].label = e.target.value; setItems(copy); }}
                className="flex-1 h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none transition-colors"
              />
              <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={item.isRequired} onChange={(e) => { const copy = [...items]; copy[i].isRequired = e.target.checked; setItems(copy); }} className="w-4 h-4 accent-primary" />
                Req
              </label>
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-error">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
          <button
            onClick={() => setItems([...items, { label: '', isRequired: true }])}
            className="w-full h-10 border-2 border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant font-medium flex items-center justify-center gap-1 hover:border-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Item
          </button>
        </div>

        <button
          onClick={() => update.mutate({ id, name, items: items.filter(i => i.label.trim()) })}
          disabled={!name.trim() || !items.some(i => i.label.trim()) || update.isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {update.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined">save</span>Save Changes</>}
        </button>
      </div>
    </div>
  );
}
