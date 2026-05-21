'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

export default function ReportsPage() {
  const [scope, setScope] = useState('ALL');
  const { data: stores } = trpc.stores.list.useQuery();
  const activeStores = stores ?? [];

  useEffect(() => {
    if (scope !== 'ALL' || activeStores.length !== 1) return;
    setScope(activeStores[0].id);
  }, [activeStores, scope]);

  const queryInput = { scope };
  const { data: tasks, isError: tasksError } = trpc.reports.taskPerformance.useQuery({ days: 30, scope });
  const { data: checklists, isError: checklistsError } = trpc.reports.checklistCompliance.useQuery(queryInput);
  const { data: stock, isError: stockError } = trpc.reports.stockAndExpiry.useQuery(queryInput);
  const { data: incidents, isError: incidentsError } = trpc.reports.incidents.useQuery(queryInput);
  const { data: threadAnalytics } = trpc.threads.analyticsSummary.useQuery({ days: 30, storeId: scope });
  const scoped = scope === 'ALL' ? '' : `scope=${encodeURIComponent(scope)}`;
  const recommendationCards = [
    ...(tasks?.recommendations ?? []),
    ...(checklists?.recommendations ?? []),
    ...(stock?.recommendations ?? []),
    ...(incidents?.recommendations ?? []),
  ].slice(0, 6);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Reports</h1>
          <p className="text-on-surface-secondary mt-1">Last 30 days overview</p>
        </div>
        <label className="block md:w-72">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Store Scope</span>
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="h-12 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 font-bold text-on-surface focus:border-primary focus:outline-none">
            {activeStores.length !== 1 && <option value="ALL">All Stores</option>}
            {activeStores.map((store: any) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </label>
      </div>

      {recommendationCards.length > 0 && (
        <div className="mb-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-warning">tips_and_updates</span>
            <h2 className="font-bold text-on-surface text-lg">Recommended Actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recommendationCards.map((item: any, index: number) => {
              const separator = item.href.includes('?') ? '&' : '?';
              const href = scoped ? `${item.href}${separator}${scoped}` : item.href;
              return (
                <Link key={`${item.type}-${index}`} href={href} className="rounded-[--radius-lg] bg-surface p-4 active:scale-[0.99]">
                  <p className="text-sm font-extrabold text-on-surface">{item.title}</p>
                  <p className="mt-2 text-xs font-bold text-navy">Open matching work</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {threadAnalytics && (
        <div className="mb-6 rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-navy">forum</span>
            <h2 className="font-bold text-on-surface text-lg">Thread Operations</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <ThreadMetric href="/hub/threads" value={threadAnalytics.totalThreads} label="Threads" />
            <ThreadMetric href="/hub/threads?tab=unacked" value={threadAnalytics.unacknowledgedUrgentCount} label="Urgent not acked" tone="danger" />
            <ThreadMetric href="/hub/threads?tab=noReply" value={threadAnalytics.noReplyCount} label="No reply" tone="warning" />
            <ThreadMetric href="/hub/threads" value={threadAnalytics.averageFirstResponseMinutes != null ? `${threadAnalytics.averageFirstResponseMinutes}m` : '-'} label="Avg reply" tone="navy" />
            <ThreadMetric href="/hub/threads?tab=needsTask" value={`${threadAnalytics.taskConversionRate}%`} label="Made tasks" tone="success" />
          </div>
          {threadAnalytics.recurringIssueKeywords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {threadAnalytics.recurringIssueKeywords.map((item: any) => (
                <span key={item.label} className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-on-surface-secondary">
                  {item.label}: {item.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Performance */}
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-navy">assignment</span>
            <h2 className="font-bold text-on-surface text-lg">Task Performance</h2>
          </div>
          {tasksError ? (
            <ErrorDisplay />
          ) : tasks ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{tasks.created}</p>
                  <p className="text-xs text-on-surface-secondary">Created</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{tasks.completed}</p>
                  <p className="text-xs text-on-surface-secondary">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-brand">{tasks.rate}%</p>
                  <p className="text-xs text-on-surface-secondary">Rate</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-warning/10 rounded-[--radius-lg] p-3 text-center">
                  <p className="text-xl font-bold text-warning">{tasks.needsHelp}</p>
                  <p className="text-xs text-on-surface-secondary">Need Help</p>
                </div>
                <div className="bg-error/5 rounded-[--radius-lg] p-3 text-center">
                  <p className="text-xl font-bold text-error">{tasks.overdue}</p>
                  <p className="text-xs text-on-surface-secondary">Overdue</p>
                </div>
                <div className="bg-surface-cream rounded-[--radius-lg] p-3 text-center">
                  <p className="text-xl font-bold text-on-surface">{tasks.avgCompletionHours != null ? `${tasks.avgCompletionHours}h` : '—'}</p>
                  <p className="text-xs text-on-surface-secondary">Avg Done</p>
                </div>
              </div>
              <div className="h-3 bg-surface-cream rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${tasks.rate}%` }} />
              </div>
              {tasks.bottlenecks && tasks.bottlenecks.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-secondary mb-2 uppercase tracking-wide">Busy Areas</p>
                  <div className="space-y-2">
                    {tasks.bottlenecks.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface truncate flex-1">{item.workArea}</span>
                        <span className="text-xs font-bold text-warning ml-2">{item.count} open</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tasks.topStaff && tasks.topStaff.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-secondary mb-2 uppercase tracking-wide">Top Performers</p>
                  <div className="space-y-2">
                    {tasks.topStaff.map((staff: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface truncate flex-1">{staff.name}</span>
                        <span className="text-xs font-bold text-success ml-2">{staff.count} done</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <LoadingSkeleton />}
        </div>

        {/* Checklist Compliance */}
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-brand">checklist</span>
            <h2 className="font-bold text-on-surface text-lg">Checklist Compliance</h2>
          </div>
          {checklistsError ? (
            <ErrorDisplay />
          ) : checklists ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{checklists.submissionRate}%</p>
                  <p className="text-xs text-on-surface-secondary">Days Submitted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{checklists.totalSubmissions}</p>
                  <p className="text-xs text-on-surface-secondary">Total Submissions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-navy">{checklists.avgTime ?? '—'}</p>
                  <p className="text-xs text-on-surface-secondary">Avg Time</p>
                </div>
              </div>
              {checklists.mostSkipped.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-secondary mb-2 uppercase tracking-wide">Most Skipped Items</p>
                  <div className="space-y-2">
                    {checklists.mostSkipped.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface truncate flex-1">{item.label}</span>
                        <span className="text-xs font-bold text-warning ml-2">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <LoadingSkeleton />}
        </div>

        {/* Stock & Expiry */}
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-warning">inventory_2</span>
            <h2 className="font-bold text-on-surface text-lg">Stock & Expiry</h2>
          </div>
          {stockError ? (
            <ErrorDisplay />
          ) : stock ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-warning/10 rounded-[--radius-lg] p-4 text-center">
                  <p className="text-2xl font-bold text-warning">{stock.activeAlerts}</p>
                  <p className="text-xs text-on-surface-secondary">Expiry Alerts</p>
                </div>
                <div className="bg-error/5 rounded-[--radius-lg] p-4 text-center">
                  <p className="text-2xl font-bold text-error">{stock.stockOutsThisWeek}</p>
                  <p className="text-xs text-on-surface-secondary">Stock-Outs (7d)</p>
                </div>
                <div className="bg-surface-cream rounded-[--radius-lg] p-4 text-center">
                  <p className="text-2xl font-bold text-on-surface">{stock.avgRestockHours != null ? `${stock.avgRestockHours}h` : '—'}</p>
                  <p className="text-xs text-on-surface-secondary">Avg Restock</p>
                </div>
              </div>
              {stock.topStockOuts.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-secondary mb-2 uppercase tracking-wide">Most Reported</p>
                  <div className="space-y-2">
                    {stock.topStockOuts.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface truncate flex-1">{item.productName}</span>
                        <span className="text-xs font-bold text-error ml-2">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <LoadingSkeleton />}
        </div>

        {/* Incidents */}
        <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-error">report_problem</span>
            <h2 className="font-bold text-on-surface text-lg">Incidents</h2>
          </div>
          {incidentsError ? (
            <ErrorDisplay />
          ) : incidents ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{incidents.thisMonth}</p>
                  <p className="text-xs text-on-surface-secondary">This Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface-secondary">{incidents.lastMonth}</p>
                  <p className="text-xs text-on-surface-secondary">Last Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{incidents.avgResolutionHours != null ? `${incidents.avgResolutionHours}h` : '—'}</p>
                  <p className="text-xs text-on-surface-secondary">Avg Resolution</p>
                </div>
              </div>
              {incidents.openByCategory.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-secondary mb-2 uppercase tracking-wide">Open by Category</p>
                  <div className="space-y-2">
                    {incidents.openByCategory.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface">{item.category.replaceAll('_', ' ')}</span>
                        <span className="text-xs font-bold text-error">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {incidents.openByCategory.length === 0 && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  No open incidents
                </div>
              )}
            </div>
          ) : <LoadingSkeleton />}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-surface-cream rounded-lg w-1/3" />
      <div className="h-4 bg-surface-cream rounded w-2/3" />
      <div className="h-4 bg-surface-cream rounded w-1/2" />
    </div>
  );
}

function ErrorDisplay() {
  return (
    <div className="text-sm text-error flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">error</span>
      Failed to load
    </div>
  );
}

function ThreadMetric({ href, value, label, tone = 'default' }: { href: string; value: string | number; label: string; tone?: 'default' | 'danger' | 'warning' | 'navy' | 'success' }) {
  const toneClass = tone === 'danger'
    ? 'bg-error/5 text-error'
    : tone === 'warning'
      ? 'bg-warning/10 text-warning'
      : tone === 'navy'
        ? 'bg-navy/10 text-navy'
        : tone === 'success'
          ? 'bg-success/10 text-success'
          : 'bg-surface text-on-surface';
  return (
    <Link href={href} className={`rounded-[--radius-lg] p-3 text-center transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/30 hover:shadow-sm ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-on-surface-secondary">{label}</p>
      <span aria-hidden="true" className="material-symbols-outlined mt-1 text-[16px] text-on-surface-secondary">chevron_right</span>
    </Link>
  );
}
