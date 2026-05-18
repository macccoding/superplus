'use client';

import { trpc } from '@/lib/trpc-client';

export default function ReportsPage() {
  const { data: tasks, isError: tasksError } = trpc.reports.taskPerformance.useQuery({ days: 30 });
  const { data: checklists, isError: checklistsError } = trpc.reports.checklistCompliance.useQuery();
  const { data: stock, isError: stockError } = trpc.reports.stockAndExpiry.useQuery();
  const { data: incidents, isError: incidentsError } = trpc.reports.incidents.useQuery();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-on-surface">Reports</h1>
        <p className="text-on-surface-variant mt-1">Last 30 days overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Performance */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-secondary">assignment</span>
            <h2 className="font-bold text-on-surface text-lg">Task Performance</h2>
          </div>
          {tasksError ? (
            <ErrorDisplay />
          ) : tasks ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{tasks.created}</p>
                  <p className="text-xs text-on-surface-variant">Created</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{tasks.completed}</p>
                  <p className="text-xs text-on-surface-variant">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{tasks.rate}%</p>
                  <p className="text-xs text-on-surface-variant">Rate</p>
                </div>
              </div>
              <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${tasks.rate}%` }} />
              </div>
              {tasks.topStaff && tasks.topStaff.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Top Performers</p>
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
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-primary">checklist</span>
            <h2 className="font-bold text-on-surface text-lg">Checklist Compliance</h2>
          </div>
          {checklistsError ? (
            <ErrorDisplay />
          ) : checklists ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{checklists.submissionRate}%</p>
                  <p className="text-xs text-on-surface-variant">Days Submitted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{checklists.totalSubmissions}</p>
                  <p className="text-xs text-on-surface-variant">Total Submissions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">{checklists.avgTime ?? '—'}</p>
                  <p className="text-xs text-on-surface-variant">Avg Time</p>
                </div>
              </div>
              {checklists.mostSkipped.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Most Skipped Items</p>
                  <div className="space-y-2">
                    {checklists.mostSkipped.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-on-surface truncate flex-1">{item.label}</span>
                        <span className="text-xs font-bold text-tertiary ml-2">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <LoadingSkeleton />}
        </div>

        {/* Stock & Expiry */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-tertiary">inventory_2</span>
            <h2 className="font-bold text-on-surface text-lg">Stock & Expiry</h2>
          </div>
          {stockError ? (
            <ErrorDisplay />
          ) : stock ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-tertiary-container/10 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-tertiary">{stock.activeAlerts}</p>
                  <p className="text-xs text-on-surface-variant">Expiry Alerts</p>
                </div>
                <div className="bg-error/5 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-error">{stock.stockOutsThisWeek}</p>
                  <p className="text-xs text-on-surface-variant">Stock-Outs (7d)</p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-on-surface">{stock.avgRestockHours != null ? `${stock.avgRestockHours}h` : '—'}</p>
                  <p className="text-xs text-on-surface-variant">Avg Restock</p>
                </div>
              </div>
              {stock.topStockOuts.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Most Reported</p>
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
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
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
                  <p className="text-xs text-on-surface-variant">This Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-outline">{incidents.lastMonth}</p>
                  <p className="text-xs text-on-surface-variant">Last Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-on-surface">{incidents.avgResolutionHours != null ? `${incidents.avgResolutionHours}h` : '—'}</p>
                  <p className="text-xs text-on-surface-variant">Avg Resolution</p>
                </div>
              </div>
              {incidents.openByCategory.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Open by Category</p>
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
      <div className="h-8 bg-surface-container-high rounded-lg w-1/3" />
      <div className="h-4 bg-surface-container-high rounded w-2/3" />
      <div className="h-4 bg-surface-container-high rounded w-1/2" />
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
