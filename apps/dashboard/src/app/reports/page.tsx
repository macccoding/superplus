'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@superplus/auth';
import type { Product, StockEvent, Task, Issue, Markdown, Checklist } from '@superplus/db';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { DashboardShell } from '../components/dashboard-shell';
import { DateRangePicker, type DateRange } from '../components/date-range-picker';

type ReportType = 'daily' | 'weekly' | 'monthly';

interface ReportData {
  stockouts: number;
  deliveries: number;
  tasksCompleted: number;
  tasksTotal: number;
  issuesOpened: number;
  issuesResolved: number;
  checklistsCompleted: number;
  markdownsCreated: number;
  markdownTotal: number;
}

export default function ReportsPage() {
  const supabase = useSupabase();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);

  function selectReportType(type: ReportType) {
    setReportType(type);
    const now = new Date();
    switch (type) {
      case 'daily':
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case 'weekly':
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) });
        break;
      case 'monthly':
        setDateRange({ from: startOfMonth(now), to: endOfDay(now) });
        break;
    }
  }

  async function generateReport() {
    setGenerating(true);
    setReportData(null);

    try {
      const fromStr = dateRange.from.toISOString();
      const toStr = dateRange.to.toISOString();

      const [stockEventsRes, tasksRes, issuesRes, checklistsRes, markdownsRes] = await Promise.all([
        supabase
          .from('stock_events')
          .select('event_type')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
        supabase
          .from('tasks')
          .select('status')
          .gte('shift_date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('shift_date', format(dateRange.to, 'yyyy-MM-dd')),
        supabase
          .from('issues')
          .select('status, created_at, resolved_at')
          .or(`created_at.gte.${fromStr},resolved_at.gte.${fromStr}`)
          .or(`created_at.lte.${toStr},resolved_at.lte.${toStr}`),
        supabase
          .from('checklists')
          .select('status')
          .gte('shift_date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('shift_date', format(dateRange.to, 'yyyy-MM-dd')),
        supabase
          .from('markdowns')
          .select('original_price, markdown_price')
          .gte('created_at', fromStr)
          .lte('created_at', toStr),
      ]);

      const stockEvents = (stockEventsRes.data ?? []) as Pick<StockEvent, 'event_type'>[];
      const tasks = (tasksRes.data ?? []) as Pick<Task, 'status'>[];
      const issues = (issuesRes.data ?? []) as Pick<Issue, 'status' | 'created_at' | 'resolved_at'>[];
      const checklists = (checklistsRes.data ?? []) as Pick<Checklist, 'status'>[];
      const markdowns = (markdownsRes.data ?? []) as Pick<Markdown, 'original_price' | 'markdown_price'>[];

      setReportData({
        stockouts: stockEvents.filter((e) => e.event_type === 'stockout').length,
        deliveries: stockEvents.filter((e) => e.event_type === 'delivery').length,
        tasksCompleted: tasks.filter((t) => t.status === 'done').length,
        tasksTotal: tasks.length,
        issuesOpened: issues.filter((i) => i.created_at >= fromStr).length,
        issuesResolved: issues.filter((i) => i.status === 'resolved').length,
        checklistsCompleted: checklists.filter((c) => c.status === 'completed').length,
        markdownsCreated: markdowns.length,
        markdownTotal: markdowns.reduce((sum, m) => sum + (m.original_price - m.markdown_price), 0),
      });
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  function exportCSV() {
    if (!reportData) return;

    const rows = [
      ['Metric', 'Value'],
      ['Report Period', `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`],
      ['Stockouts', String(reportData.stockouts)],
      ['Deliveries', String(reportData.deliveries)],
      ['Tasks Completed', `${reportData.tasksCompleted} / ${reportData.tasksTotal}`],
      ['Task Completion Rate', `${reportData.tasksTotal > 0 ? Math.round((reportData.tasksCompleted / reportData.tasksTotal) * 100) : 0}%`],
      ['Issues Opened', String(reportData.issuesOpened)],
      ['Issues Resolved', String(reportData.issuesResolved)],
      ['Checklists Completed', String(reportData.checklistsCompleted)],
      ['Markdowns Created', String(reportData.markdownsCreated)],
      ['Markdown Dollar Impact', `$${reportData.markdownTotal.toFixed(2)}`],
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `superplus-report-${format(dateRange.from, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Reports</h1>
        <p className="text-sm text-text-secondary mt-1">Generate and export operational reports</p>
      </div>

      {/* Controls */}
      <div className="bg-surface rounded-card border border-gray-100 p-6 mb-6">
        {/* Report Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">Report Type</label>
          <div className="flex gap-2">
            {([
              { key: 'daily' as ReportType, label: 'Daily Summary' },
              { key: 'weekly' as ReportType, label: 'Weekly Report' },
              { key: 'monthly' as ReportType, label: 'Monthly P&L' },
            ]).map((rt) => (
              <button
                key={rt.key}
                onClick={() => selectReportType(rt.key)}
                className={`px-4 py-2 text-sm font-medium rounded-button border transition-colors ${
                  reportType === rt.key
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">Date Range</label>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={generateReport}
            disabled={generating}
            className="px-5 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Report'
            )}
          </button>
          {reportData && (
            <button
              onClick={exportCSV}
              className="px-5 py-2.5 bg-surface text-text-primary text-sm font-semibold rounded-button border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Report Preview */}
      {reportData && (
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-lg font-heading font-semibold text-text-primary mb-1">
            {reportType === 'daily' ? 'Daily Summary' : reportType === 'weekly' ? 'Weekly Report' : 'Monthly P&L'}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Stockouts</p>
              <p className="text-2xl font-heading font-bold text-danger mt-1">{reportData.stockouts}</p>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Deliveries</p>
              <p className="text-2xl font-heading font-bold text-success mt-1">{reportData.deliveries}</p>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Task Completion</p>
              <p className="text-2xl font-heading font-bold text-text-primary mt-1">
                {reportData.tasksTotal > 0
                  ? `${Math.round((reportData.tasksCompleted / reportData.tasksTotal) * 100)}%`
                  : 'N/A'}
              </p>
              <p className="text-xs text-text-secondary">
                {reportData.tasksCompleted}/{reportData.tasksTotal}
              </p>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Checklists Done</p>
              <p className="text-2xl font-heading font-bold text-text-primary mt-1">
                {reportData.checklistsCompleted}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Issues Opened</p>
              <p className="text-2xl font-heading font-bold text-warning mt-1">{reportData.issuesOpened}</p>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Issues Resolved</p>
              <p className="text-2xl font-heading font-bold text-success mt-1">{reportData.issuesResolved}</p>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <p className="text-xs text-text-secondary uppercase font-medium">Markdown Impact</p>
              <p className="text-2xl font-heading font-bold text-danger mt-1">
                -${reportData.markdownTotal.toFixed(2)}
              </p>
              <p className="text-xs text-text-secondary">
                {reportData.markdownsCreated} markdowns
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!reportData && !generating && (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <p className="text-text-secondary text-sm">
            Select a report type and date range, then click Generate Report
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
