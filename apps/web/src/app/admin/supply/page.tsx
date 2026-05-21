'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

export default function SupplyPage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const storeOptions = (stores ?? []).filter((store: any) => store.isActive !== false);
  const canUseAllStores = storeOptions.length > 1;
  const [scope, setScope] = useState('ALL');
  const [days, setDays] = useState<7 | 30>(7);
  const activeScope = canUseAllStores ? scope : storeOptions[0]?.id;
  const { data, isLoading } = trpc.admin.supplyOverview.useQuery({ scope: activeScope, days });

  const acknowledge = trpc.admin.acknowledgeStockOut.useMutation({
    onSuccess: () => {
      utils.admin.invalidate();
      utils.stockOuts.invalidate();
    },
  });
  const markPulled = trpc.admin.markExpiryPulled.useMutation({
    onSuccess: () => {
      utils.admin.invalidate();
      utils.expiryAlerts.invalidate();
    },
  });
  const createTask = trpc.admin.createTaskFromAttention.useMutation({
    onSuccess: () => {
      utils.admin.invalidate();
      utils.tasks.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Supply Ops</h1>
          <p className="text-on-surface-secondary mt-1">Stock-outs, expiry alerts, suppliers, and open orders</p>
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
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <Stat label="Stock-outs" value={data?.counts.activeStockOuts ?? 0} icon="inventory" tone="danger" href="/tools/stock-out" />
        <Stat label="Repeat" value={data?.counts.repeatStockOuts ?? 0} icon="repeat" tone="warning" href="/tools/stock-out" />
        <Stat label="Expiry" value={data?.counts.activeExpiryAlerts ?? 0} icon="event_available" tone="warning" href="/tools/expiry-tracker" />
        <Stat label="Overdue" value={data?.counts.overdueExpiryAlerts ?? 0} icon="event_busy" tone="danger" href="/tools/expiry-tracker" />
        <Stat label="Partial PO" value={data?.counts.partialOrders ?? 0} icon="receipt_long" tone="warning" href="/admin/orders" />
        <Stat label="Late PO" value={data?.counts.lateOrders ?? 0} icon="schedule" tone="danger" href="/admin/orders" />
        <Stat label="Suppliers" value={data?.counts.suppliers ?? 0} icon="local_shipping" href="/admin/suppliers" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <Header icon="inventory" title="Active Stock-outs" href="/admin/products" />
            <div className="divide-y divide-outline/10">
              {data?.stockOuts.slice(0, 10).map((item: any) => (
                <div key={item.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-on-surface">{item.productName}</h2>
                      {item.repeatCount >= 2 && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-warning/15 text-warning">Repeat issue</span>}
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-surface-cream text-on-surface-secondary">{item.status.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-on-surface-secondary mt-1">{item.store.name} · {item.location || 'No location'} · {item.reportedBy.fullName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button onClick={() => acknowledge.mutate({ id: item.id, scope: activeScope })} className="h-12 px-3 rounded-[--radius-lg] bg-navy text-on-navy text-sm font-bold">Acknowledge</button>
                    <button onClick={() => createTask.mutate({ scope: activeScope, type: 'STOCK_OUT', sourceId: item.id, title: `Resolve stock-out: ${item.productName}` })} className="h-12 px-3 rounded-[--radius-lg] bg-brand text-on-brand text-sm font-bold">Create Task</button>
                  </div>
                </div>
              ))}
              {data?.stockOuts.length === 0 && <Empty icon="inventory_2" text="No active stock-outs." />}
            </div>
          </section>

          <section className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <Header icon="repeat" title="Repeat Issues" href="/admin/products" />
            <div className="divide-y divide-outline/10">
              {data?.repeatStockOuts.slice(0, 8).map((item: any) => (
                <div key={`${item.storeId}-${item.productName}`} className="p-4">
                  <p className="font-bold text-on-surface">{item.productName}</p>
                  <p className="text-sm text-on-surface-secondary">{item.count} reports in {days} days</p>
                </div>
              ))}
              {data?.repeatStockOuts.length === 0 && <Empty icon="check_circle" text="No repeat stock-out patterns." />}
            </div>
          </section>

          <section className="xl:col-span-2 bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <Header icon="event_available" title="Expiry Alerts" href="/tools/expiry-tracker" />
            <div className="divide-y divide-outline/10">
              {data?.expiryAlerts.slice(0, 10).map((item: any) => (
                <div key={item.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-on-surface">{item.productName}</h2>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${item.timing === 'overdue' ? 'bg-error/10 text-error' : 'bg-warning/15 text-warning'}`}>{item.timing}</span>
                    </div>
                    <p className="text-sm text-on-surface-secondary mt-1">{item.store.name} · {item.quantity} item(s) · expires {new Date(item.expiryDate).toLocaleDateString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button onClick={() => markPulled.mutate({ id: item.id, scope: activeScope })} className="h-12 px-3 rounded-[--radius-lg] bg-success text-white text-sm font-bold">Mark Pulled</button>
                    <button onClick={() => createTask.mutate({ scope: activeScope, type: 'EXPIRY_ALERT', sourceId: item.id, title: `Pull expiry item: ${item.productName}` })} className="h-12 px-3 rounded-[--radius-lg] bg-brand text-on-brand text-sm font-bold">Create Task</button>
                  </div>
                </div>
              ))}
              {data?.expiryAlerts.length === 0 && <Empty icon="check_circle" text="No active expiry alerts." />}
            </div>
          </section>

          <section className="bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <Header icon="local_shipping" title="Supplier Reliability" href="/admin/suppliers" />
            <div className="divide-y divide-outline/10">
              {data?.suppliers.slice(0, 8).map((supplier: any) => (
                <Link key={supplier.id} href={`/admin/suppliers?scope=${supplier.storeId}`} className="block p-4 active:bg-surface">
                  <p className="font-bold text-on-surface">{supplier.name}</p>
                  <p className="text-sm text-on-surface-secondary">{supplier.store.name} · {supplier.orderCount} orders · {supplier.partialOrders} partial</p>
                  {supplier.avgReceiveHours !== null && <p className="text-xs text-on-surface-secondary mt-1">Avg receive: {Math.round(supplier.avgReceiveHours / 24)} day(s)</p>}
                </Link>
              ))}
              {data?.suppliers.length === 0 && <Empty icon="local_shipping" text="No suppliers in scope." />}
            </div>
          </section>

          <section className="xl:col-span-3 bg-surface-white rounded-[--radius-lg] shadow-sm overflow-hidden">
            <Header icon="receipt_long" title="Open Orders" href="/admin/orders" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-outline/10">
              {data?.orders.slice(0, 8).map((order: any) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="p-4 flex items-center justify-between gap-3 border-b border-outline/10 active:bg-surface">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold text-on-surface">{order.orderNumber}</p>
                      {order.isLate && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-error/10 text-error">Late</span>}
                      {order.status === 'PARTIALLY_RECEIVED' && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-warning/15 text-warning">Partial</span>}
                    </div>
                    <p className="text-sm text-on-surface-secondary mt-1">{order.store.name} · {order.supplier.name} · {order.remainingItems} remaining line(s)</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-secondary">chevron_right</span>
                </Link>
              ))}
            </div>
            {data?.orders.length === 0 && <Empty icon="receipt_long" text="No open purchase orders." />}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone = 'default', href }: { label: string; value: number; icon: string; tone?: 'default' | 'danger' | 'warning'; href?: string }) {
  const color = tone === 'danger' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-navy';
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
        <span className="text-2xl font-extrabold text-on-surface">{value}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-on-surface-secondary">{label}</p>
        {href && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-secondary">chevron_right</span>}
      </div>
    </>
  );
  const className = "block bg-surface-white rounded-[--radius-lg] p-4 shadow-sm min-h-[96px] transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 hover:shadow-md";
  if (href) {
    return (
      <Link href={href} className={className} aria-label={`Open ${label}`}>
        {content}
      </Link>
    );
  }
  return (
    <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm min-h-[96px]">
      {content}
    </div>
  );
}

function Header({ icon, title, href }: { icon: string; title: string; href: string }) {
  return (
    <div className="p-4 border-b border-outline/20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-navy">{icon}</span>
        <h2 className="font-extrabold text-on-surface">{title}</h2>
      </div>
      <Link href={href} className="h-10 px-3 rounded-[--radius-md] bg-surface-cream text-sm font-bold text-on-surface-secondary flex items-center">Open</Link>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="p-8 text-center text-on-surface-secondary">
      <span className="material-symbols-outlined text-[36px]">{icon}</span>
      <p className="text-sm mt-2">{text}</p>
    </div>
  );
}
