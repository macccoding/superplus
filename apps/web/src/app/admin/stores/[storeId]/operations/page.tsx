'use client';

import { Children, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader, PageSkeleton } from '@superplus/ui';
import { trpc } from '@/lib/trpc-client';

export default function StoreOperationsPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;
  const { data, isLoading, isError } = trpc.admin.storeOperations.useQuery({ storeId, days: 7 });

  if (isLoading) return <PageSkeleton variant="admin-tasks" />;
  if (isError || !data) {
    return (
      <div className="rounded-[--radius-lg] bg-error/10 p-5 font-bold text-error">
        Store operations could not load.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={data.store.name}
        subtitle={`${data.store.parish} · Store operations`}
        action={<Link href="/admin" className="flex h-12 items-center justify-center rounded-[--radius-lg] bg-surface-cream px-4 font-bold text-on-surface">Dashboard</Link>}
      />

      <section className="mb-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-on-surface-secondary">Health Score</p>
            <p className={`text-4xl font-extrabold ${data.health.status === 'danger' ? 'text-error' : data.health.status === 'warning' ? 'text-warning' : 'text-success'}`}>{data.health.riskScore}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Metric label="Late" value={data.health.overdueTasks} danger />
            <Metric label="Help" value={data.health.helpTasks} danger />
            <Metric label="Review" value={data.health.reviewTasks} />
            <Metric label="Stock" value={data.health.stockOuts} danger />
            <Metric label="Expiry" value={data.health.expiryAlerts} danger />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.riskReasons.map((reason: string) => (
            <span key={reason} className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">{reason}</span>
          ))}
          {data.riskReasons.length === 0 && <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">No major risks right now</span>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Late Tasks" icon="event_busy" empty="No late tasks">
            {data.lateTasks.map((task: any) => <TaskRow key={task.id} task={task} />)}
          </Panel>
          <Panel title="Help Requests" icon="support_agent" empty="No help requests">
            {data.helpRequests.map((task: any) => <TaskRow key={task.id} task={task} />)}
          </Panel>
          <Panel title="Review Queue" icon="rate_review" empty="No tasks waiting for review">
            {data.reviewQueue.map((task: any) => <TaskRow key={task.id} task={task} />)}
          </Panel>
          <Panel title="Unassigned Work" icon="person_search" empty="No unassigned active tasks">
            {data.unassigned.map((task: any) => <TaskRow key={task.id} task={task} />)}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Supply Alerts" icon="inventory" empty="No stock or expiry alerts">
            {data.stockOuts.map((item: any) => (
              <SourceRow key={`stock-${item.id}`} title={item.productName} meta={`${item.location || 'No location'} · ${item.status}`} href={`/admin?attentionType=STOCK_OUT&sourceId=${item.id}&detailScope=${data.store.id}`} />
            ))}
            {data.expiryAlerts.map((item: any) => (
              <SourceRow key={`expiry-${item.id}`} title={item.productName} meta={`${item.quantity} item(s) · expires ${new Date(item.expiryDate).toLocaleDateString()}`} href={`/admin?attentionType=EXPIRY_ALERT&sourceId=${item.id}&detailScope=${data.store.id}`} />
            ))}
          </Panel>

          <Panel title="Incidents" icon="report_problem" empty="No unresolved incidents">
            {data.incidents.map((item: any) => (
              <SourceRow key={item.id} title={item.title} meta={`${item.severity} · ${item.category}`} href={`/admin?attentionType=INCIDENT&sourceId=${item.id}&detailScope=${data.store.id}`} />
            ))}
          </Panel>

          <Panel title="Missed Checklists" icon="checklist" empty="No missed checklists">
            {data.missedChecklists.map((item: any) => (
              <SourceRow key={item.id} title={item.name} meta="Not submitted by closing time" href={`/admin?attentionType=MISSED_CHECKLIST&sourceId=${item.id}&detailScope=${data.store.id}`} />
            ))}
          </Panel>

          <Panel title="Overloaded Staff" icon="groups" empty="No overloaded staff">
            {data.overloadedStaff.map((staff: any) => (
              <Link key={staff.id} href={`/admin/tasks?scope=${data.store.id}&search=${encodeURIComponent(staff.fullName)}`} className="flex items-center justify-between rounded-[--radius-lg] bg-surface p-3">
                <span className="font-bold text-on-surface">{staff.fullName}</span>
                <span className="text-sm font-bold text-warning">{staff.active} active</span>
              </Link>
            ))}
          </Panel>

          <Panel title="Admin Actions" icon="history" empty="No admin actions logged">
            {data.actionLog.map((action: any) => (
              <div key={action.id} className="rounded-[--radius-lg] bg-surface p-3">
                <p className="text-sm font-bold text-on-surface">{action.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-on-surface-secondary">{action.actor?.fullName ?? 'Admin'} · {new Date(action.createdAt).toLocaleString()}</p>
                {action.note && <p className="mt-1 text-xs text-on-surface-secondary">{action.note}</p>}
              </div>
            ))}
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-[--radius-lg] bg-surface p-3 text-center">
      <p className={`text-xl font-extrabold ${danger && value > 0 ? 'text-error' : 'text-on-surface'}`}>{value}</p>
      <p className="text-xs font-bold text-on-surface-secondary">{label}</p>
    </div>
  );
}

function Panel({ title, icon, empty, children }: { title: string; icon: string; empty: string; children: ReactNode }) {
  const hasChildren = Children.count(children) > 0;
  return (
    <section className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-navy">{icon}</span>
        <h2 className="font-extrabold text-on-surface">{title}</h2>
      </div>
      <div className="space-y-2">
        {hasChildren ? children : <p className="text-sm text-on-surface-secondary">{empty}</p>}
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: any }) {
  return (
    <Link href={`/hub/tasks/${task.id}?from=admin`} className="block rounded-[--radius-lg] bg-surface p-3">
      <p className="truncate text-sm font-bold text-on-surface">{task.title}</p>
      <p className="text-xs text-on-surface-secondary">{task.assignedTo?.fullName ?? 'Unassigned'} · {task.status.replaceAll('_', ' ')}</p>
    </Link>
  );
}

function SourceRow({ title, meta, href }: { title: string; meta: string; href: string }) {
  return (
    <Link href={href} className="block rounded-[--radius-lg] bg-surface p-3">
      <p className="truncate text-sm font-bold text-on-surface">{title}</p>
      <p className="text-xs text-on-surface-secondary">{meta}</p>
    </Link>
  );
}
