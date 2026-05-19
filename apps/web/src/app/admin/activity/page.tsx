'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const sourceOptions = ['TASK', 'ADMIN_ACTION', 'INCIDENT', 'STOCK_OUT', 'EXPIRY_ALERT', 'SUGGESTION', 'FLAGGED_LOG'];

export default function ActivityPage() {
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [actorId, setActorId] = useState('ALL');
  const [cursor, setCursor] = useState<string | undefined>();
  const [items, setItems] = useState<any[]>([]);
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data: staff } = trpc.users.list.useQuery({ scope: activeScope, isActive: true });
  const { data, isLoading } = trpc.admin.activityFeed.useQuery({
    scope: activeScope,
    type: type === 'ALL' ? undefined : type,
    severity: severity === 'ALL' ? undefined : severity as any,
    actorId: actorId === 'ALL' ? undefined : actorId,
    take: 40,
    cursor,
  });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [activeScope, type, severity, actorId]);

  useEffect(() => {
    if (!data) return;
    setItems((current) => cursor ? [...current, ...data.items.filter((item: any) => !current.some((existing: any) => existing.id === item.id))] : data.items);
  }, [data, cursor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Activity</h1>
          <p className="text-on-surface-secondary mt-1">Audit trail and operational changes</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <select value={activeScope ?? ''} onChange={(e) => setScope(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Store scope">
            {canUseAllStores && <option value="ALL">All Stores</option>}
            {storeOptions.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Type filter">
            <option value="ALL">All Types</option>
            {sourceOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Severity filter">
            <option value="ALL">All Severity</option>
            <option value="danger">Urgent</option>
            <option value="warning">Attention</option>
            <option value="info">Info</option>
          </select>
          <select value={actorId} onChange={(e) => setActorId(e.target.value)} className="h-12 px-3 bg-surface-white border-2 border-outline rounded-[--radius-lg] text-sm font-bold text-on-surface" aria-label="Person filter">
            <option value="ALL">All People</option>
            {staff?.map((user: any) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : (
        <div className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
          <div className="divide-y divide-outline/10">
            {items.map((item: any) => (
              <ActivityItem key={item.id} item={item} />
            ))}
            {items.length === 0 && (
              <div className="p-10 text-center text-on-surface-secondary">
                <span className="material-symbols-outlined text-[44px]">manage_search</span>
                <p className="font-bold text-on-surface mt-3">No activity matches these filters</p>
                <p className="text-sm mt-1">Try all types or all people.</p>
              </div>
            )}
          </div>
          {data?.nextCursor && (
            <div className="p-4 border-t border-outline/20">
              <button onClick={() => setCursor(data.nextCursor)} className="w-full h-12 rounded-[--radius-lg] bg-surface-cream text-sm font-bold text-on-surface-secondary">Load older activity</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ item }: { item: any }) {
  const tone = item.severity === 'danger' ? 'bg-error/10 text-error' : item.severity === 'warning' ? 'bg-warning/15 text-warning' : 'bg-navy/10 text-navy';
  const icon = item.type === 'TASK' ? 'assignment' : item.type === 'INCIDENT' ? 'report_problem' : item.type === 'STOCK_OUT' ? 'inventory' : item.type === 'EXPIRY_ALERT' ? 'event_available' : item.type === 'SUGGESTION' ? 'lightbulb' : item.type === 'FLAGGED_LOG' ? 'flag' : 'admin_panel_settings';
  const content = (
    <div className="p-4 sm:p-5 min-h-[76px] flex items-start gap-3 active:bg-surface">
      <div className={`w-11 h-11 rounded-[--radius-lg] flex items-center justify-center shrink-0 ${tone}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-extrabold text-on-surface capitalize">{String(item.title).replaceAll('_', ' ')}</h2>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-surface-cream text-on-surface-secondary">{item.type.replaceAll('_', ' ')}</span>
        </div>
        <p className="text-sm text-on-surface-secondary mt-1">{item.subtitle}</p>
        <p className="text-xs text-on-surface-secondary mt-2">
          {item.store?.name || 'All stores'} · {item.actor?.fullName || 'System'} · {new Date(item.timestamp).toLocaleString()}
        </p>
      </div>
      <span className="material-symbols-outlined text-on-surface-secondary mt-2">chevron_right</span>
    </div>
  );

  if (!item.href) return content;
  return <Link href={item.href}>{content}</Link>;
}
