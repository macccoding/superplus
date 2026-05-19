'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ChecklistsAdminPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const [days, setDays] = useState<7 | 30>(7);
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: templates } = trpc.checklists.listTemplates.useQuery({ scope: activeScope, includeInactive: true });
  const { data: health } = trpc.admin.checklistHealth.useQuery({ scope: activeScope, days });
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStoreId, setNewStoreId] = useState('');
  const [newItems, setNewItems] = useState<{ label: string; isRequired: boolean }[]>([{ label: '', isRequired: true }]);

  const createTemplate = trpc.checklists.createTemplate.useMutation({
    onSuccess: () => {
      utils.checklists.invalidate();
      utils.admin.invalidate();
      setShowCreate(false);
      setNewName('');
      setNewStoreId('');
      setNewItems([{ label: '', isRequired: true }]);
    },
  });
  const updateTemplate = trpc.checklists.updateTemplate.useMutation({
    onSuccess: () => {
      utils.checklists.invalidate();
      utils.admin.invalidate();
    },
  });

  const templateHealth = new Map<string, any>((health?.templates ?? []).map((item: any) => [item.id, item]));
  const selectedStore = activeScope === 'ALL' ? newStoreId : activeScope;
  const canCreate = newName.trim() && newItems.some((item) => item.label.trim()) && selectedStore;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Checklists</h1>
          <p className="text-on-surface-secondary mt-1">Template health, submissions, and follow-up work</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 30)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Date range">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={() => setShowCreate(true)} className="col-span-2 h-12 px-5 bg-brand text-on-brand font-bold rounded-[--radius-lg] flex items-center justify-center gap-2 active:scale-95 transition-all sm:col-span-1">
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Templates" value={health?.counts.templates ?? 0} icon="checklist" />
        <Stat label="Missed Today" value={health?.counts.missedToday ?? 0} icon="assignment_late" tone="warning" />
        <Stat label="Skipped Often" value={health?.counts.skippedOften ?? 0} icon="skip_next" tone="warning" />
        <Stat label="Unused" value={health?.counts.unusedTemplates ?? 0} icon="visibility_off" />
        <Stat label="Submissions" value={health?.counts.submissions ?? 0} icon="task_alt" tone="success" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-3">
          {templates?.map((template: any) => {
            const h = templateHealth.get(template.id);
            return (
              <div key={template.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-[--radius-lg] flex items-center justify-center ${template.isActive ? 'bg-brand/10' : 'bg-surface-cream'}`}>
                      <span className={`material-symbols-outlined ${template.isActive ? 'text-brand' : 'text-on-surface-secondary'}`}>checklist</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-on-surface">{template.name}</h3>
                        <Badge label={template.isActive ? 'Active' : 'Inactive'} tone={template.isActive ? 'success' : 'default'} />
                        {h?.missedToday && <Badge label="Missed today" tone="warning" />}
                        {h?.skippedOften && <Badge label="Skipped often" tone="warning" />}
                        {h?.unused && <Badge label="Unused" />}
                      </div>
                      <p className="text-sm text-on-surface-secondary mt-1">{template.store?.name} · {template._count.items} items · {template._count.submissions} submissions</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    <button onClick={() => router.push(`/admin/checklists/${template.id}`)} className="h-12 px-3 bg-surface-cream rounded-[--radius-lg] text-sm font-bold text-on-surface-secondary">Edit</button>
                    <Link href={`/admin/checklists/submissions?templateId=${template.id}&scope=${template.storeId}`} className="h-12 px-3 bg-surface-cream rounded-[--radius-lg] text-sm font-bold text-on-surface-secondary flex items-center justify-center">History</Link>
                    <button onClick={() => updateTemplate.mutate({ id: template.id, isActive: !template.isActive, scope: template.storeId })} className={`h-12 px-3 rounded-[--radius-lg] text-sm font-bold ${template.isActive ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                      {template.isActive ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {templates?.length === 0 && <Empty icon="checklist" text="No checklist templates in scope." />}
        </section>

        <aside className="space-y-4">
          <section className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-warning">assignment_late</span>
              <h2 className="font-extrabold text-on-surface">Missed Today</h2>
            </div>
            <div className="divide-y divide-outline/10">
              {health?.missedToday.slice(0, 8).map((item: any) => (
                <Link key={`${item.storeId}-${item.templateId}`} href={`/admin/checklists/submissions?scope=${item.storeId}`} className="block p-4 active:bg-surface">
                  <p className="font-bold text-on-surface">{item.templateName}</p>
                  <p className="text-sm text-on-surface-secondary">{item.storeName}</p>
                </Link>
              ))}
              {health?.missedToday.length === 0 && <Empty icon="check_circle" text="No missed checklist alerts." />}
            </div>
          </section>

          <section className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-warning">skip_next</span>
              <h2 className="font-extrabold text-on-surface">Skipped Often</h2>
            </div>
            <div className="divide-y divide-outline/10">
              {health?.skippedItems.slice(0, 8).map((item: any) => (
                <div key={`${item.templateId}-${item.label}`} className="p-4">
                  <p className="font-bold text-on-surface">{item.label}</p>
                  <p className="text-sm text-on-surface-secondary">{item.storeName} · {item.count} skips</p>
                </div>
              ))}
              {health?.skippedItems.length === 0 && <Empty icon="check_circle" text="No recurring skipped items." />}
            </div>
          </section>
        </aside>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-white rounded-[--radius-lg] p-6 w-full max-w-lg space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface">New Checklist Template</h2>
            {activeScope === 'ALL' && (
              <select value={newStoreId} onChange={(e) => setNewStoreId(e.target.value)} className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
                <option value="">Choose store</option>
                {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            )}
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Template name (e.g. Nightly Closing)" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" autoFocus />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface">Checklist Items</label>
              {newItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input value={item.label} onChange={(e) => { const copy = [...newItems]; copy[i].label = e.target.value; setNewItems(copy); }} placeholder={`Item ${i + 1}`} className="flex-1 h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-on-surface-secondary" />
                  {newItems.length > 1 && <button aria-label="Remove item" onClick={() => setNewItems(newItems.filter((_, j) => j !== i))} className="w-12 h-12 flex items-center justify-center text-error"><span className="material-symbols-outlined text-[20px]">close</span></button>}
                </div>
              ))}
              <button onClick={() => setNewItems([...newItems, { label: '', isRequired: true }])} className="w-full h-12 border-2 border-dashed border-outline rounded-[--radius-lg] text-sm text-on-surface-secondary font-bold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Item
              </button>
            </div>
            {createTemplate.error && <p className="text-sm font-bold text-error">{createTemplate.error.message}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-14 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Cancel</button>
              <button onClick={() => createTemplate.mutate({ name: newName, scope: selectedStore, items: newItems.filter((item) => item.label.trim()) })} disabled={!canCreate || createTemplate.isPending} className="flex-1 h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone = 'default' }: { label: string; value: number; icon: string; tone?: 'default' | 'warning' | 'success' }) {
  const color = tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-navy';
  return (
    <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm min-h-[96px]">
      <div className="flex items-center justify-between">
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
        <span className="text-2xl font-extrabold text-on-surface">{value}</span>
      </div>
      <p className="text-xs font-bold uppercase text-on-surface-secondary mt-3">{label}</p>
    </div>
  );
}

function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warning' | 'success' }) {
  const styles = tone === 'warning' ? 'bg-warning/15 text-warning' : tone === 'success' ? 'bg-success/10 text-success' : 'bg-surface-cream text-on-surface-secondary';
  return <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${styles}`}>{label}</span>;
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="p-8 text-center text-on-surface-secondary">
      <span className="material-symbols-outlined text-[36px]">{icon}</span>
      <p className="text-sm mt-2">{text}</p>
    </div>
  );
}
