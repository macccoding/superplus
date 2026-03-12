'use client';

import { useMemo } from 'react';
import { useUnresolvedStockouts, useStockEvents, useCategories } from '@superplus/db/hooks';
import { format, subDays } from 'date-fns';
import { DashboardShell } from '../components/dashboard-shell';
import { StatCard } from '../components/stat-card';
import { BarChartWidget } from '../components/charts/bar-chart';
import { LineChartWidget } from '../components/charts/line-chart';

export default function InventoryPage() {
  const { data: unresolvedStockouts } = useUnresolvedStockouts();
  const { data: categories } = useCategories();
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { data: recentStockEvents } = useStockEvents({ dateFrom: thirtyDaysAgo });

  // Stockout frequency by product (top 10)
  const stockoutRankings = useMemo(() => {
    if (!recentStockEvents) return [];
    const counts: Record<string, { name: string; count: number }> = {};
    recentStockEvents
      .filter((e) => e.event_type === 'stockout')
      .forEach((e) => {
        const pid = e.product_id;
        if (!counts[pid]) counts[pid] = { name: pid.slice(0, 8), count: 0 };
        counts[pid].count++;
      });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [recentStockEvents]);

  // Stockouts by category
  const stockoutsByCategory = useMemo(() => {
    if (!unresolvedStockouts || !categories) return [];
    const catCounts: Record<string, number> = {};
    unresolvedStockouts.forEach((event) => {
      const product = (event as any).product;
      const catId = product?.category_id ?? 'unknown';
      catCounts[catId] = (catCounts[catId] ?? 0) + 1;
    });

    const catMap: Record<string, string> = {};
    categories.forEach((c) => {
      catMap[c.id] = c.name;
    });

    return Object.entries(catCounts).map(([catId, count]) => ({
      category: catMap[catId] ?? 'Unknown',
      count,
    }));
  }, [unresolvedStockouts, categories]);

  // Expiry tracking
  const expiryEvents = useMemo(() => {
    if (!recentStockEvents) return { flagged: 0, expired: 0 };
    const expiryFlags = recentStockEvents.filter((e) => e.event_type === 'expiry_flag');
    return {
      flagged: expiryFlags.length,
      expired: expiryFlags.filter((e) => !e.resolved_at).length,
    };
  }, [recentStockEvents]);

  // Waste over time (last 30 days, grouped by week)
  const wasteOverTime = useMemo(() => {
    if (!recentStockEvents) return [];
    const weekBuckets: Record<string, number> = {};
    recentStockEvents
      .filter((e) => e.event_type === 'expiry_flag')
      .forEach((e) => {
        const weekLabel = format(new Date(e.created_at), "'W'w MMM");
        weekBuckets[weekLabel] = (weekBuckets[weekLabel] ?? 0) + 1;
      });

    return Object.entries(weekBuckets)
      .map(([week, count]) => ({ week, count }))
      .slice(-8);
  }, [recentStockEvents]);

  // Delivery / restock patterns
  const restockPatterns = useMemo(() => {
    if (!recentStockEvents) return [];
    const dailyCounts: Record<string, { restocks: number; deliveries: number }> = {};
    recentStockEvents
      .filter((e) => e.event_type === 'delivery' || e.event_type === 'restock_request')
      .forEach((e) => {
        const day = format(new Date(e.created_at), 'EEE');
        if (!dailyCounts[day]) dailyCounts[day] = { restocks: 0, deliveries: 0 };
        if (e.event_type === 'delivery') dailyCounts[day].deliveries++;
        else dailyCounts[day].restocks++;
      });

    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayOrder.map((day) => ({
      day,
      restocks: dailyCounts[day]?.restocks ?? 0,
      deliveries: dailyCounts[day]?.deliveries ?? 0,
    }));
  }, [recentStockEvents]);

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Inventory Health</h1>
        <p className="text-sm text-text-secondary mt-1">Last 30 days overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          variant="danger"
          label="Active Stockouts"
          value={unresolvedStockouts?.length ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }
        />
        <StatCard
          variant="warning"
          label="Expiry Flags"
          value={expiryEvents.flagged}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
        <StatCard
          variant="success"
          label="Deliveries (30d)"
          value={recentStockEvents?.filter((e) => e.event_type === 'delivery').length ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
        />
        <StatCard
          variant="info"
          label="Restock Requests"
          value={recentStockEvents?.filter((e) => e.event_type === 'restock_request').length ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stockouts by Category */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Stockouts by Category
          </h2>
          <BarChartWidget
            data={stockoutsByCategory}
            dataKey="count"
            labelKey="category"
            color="#E31837"
            height={280}
          />
        </div>

        {/* Stockout Frequency Rankings */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Top 10 Frequently Out of Stock
          </h2>
          {stockoutRankings.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">No stockout data in the last 30 days</p>
          ) : (
            <BarChartWidget
              data={stockoutRankings}
              dataKey="count"
              labelKey="name"
              layout="vertical"
              color="#1B3A5C"
              height={280}
            />
          )}
        </div>

        {/* Restock Patterns */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Restock Patterns by Day of Week
          </h2>
          <LineChartWidget
            data={restockPatterns}
            xAxisKey="day"
            lines={[
              { dataKey: 'deliveries', color: '#2ECC71', label: 'Deliveries' },
              { dataKey: 'restocks', color: '#F5A623', label: 'Restock Requests' },
            ]}
            height={280}
          />
        </div>

        {/* Waste Over Time */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Expiry Flags Over Time
          </h2>
          <LineChartWidget
            data={wasteOverTime}
            xAxisKey="week"
            lines={[{ dataKey: 'count', color: '#E74C3C', label: 'Expiry Flags' }]}
            height={280}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
