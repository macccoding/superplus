'use client';

import { useMemo, useState, useEffect } from 'react';
import { useProducts, useCategories, useActiveMarkdowns } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import type { DailyPrice, Product } from '@superplus/db';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { StatusBadge } from '@superplus/ui';
import { DashboardShell } from '../components/dashboard-shell';
import { BarChartWidget } from '../components/charts/bar-chart';

export default function PricingPage() {
  const supabase = useSupabase();
  const { data: products } = useProducts({ isActive: true });
  const { data: categories } = useCategories();
  const { data: activeMarkdowns } = useActiveMarkdowns();
  const [priceAudit, setPriceAudit] = useState<(DailyPrice & { product?: Product })[]>([]);

  // Load recent price changes
  useEffect(() => {
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    supabase
      .from('daily_prices')
      .select('*, product:products(*)')
      .gte('effective_date', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setPriceAudit(data as any);
      });
  }, []);

  // Margin by category vs target
  const marginByCategory = useMemo(() => {
    if (!products || !categories) return [];

    const catMap: Record<string, { name: string; target: number }> = {};
    categories.forEach((c) => {
      catMap[c.id] = { name: c.name, target: c.target_margin ?? 25 };
    });

    const catAggregates: Record<string, { totalMargin: number; count: number; target: number; name: string }> = {};

    products.forEach((p) => {
      if (p.cost_price == null || p.cost_price === 0 || !p.category_id) return;
      const margin = ((p.selling_price - p.cost_price) / p.selling_price) * 100;
      const cat = catMap[p.category_id];
      if (!cat) return;

      if (!catAggregates[p.category_id]) {
        catAggregates[p.category_id] = {
          name: cat.name,
          target: cat.target,
          totalMargin: 0,
          count: 0,
        };
      }
      catAggregates[p.category_id].totalMargin += margin;
      catAggregates[p.category_id].count++;
    });

    return Object.values(catAggregates).map((agg) => ({
      category: agg.name,
      current: Number((agg.totalMargin / agg.count).toFixed(1)),
      target: agg.target,
    }));
  }, [products, categories]);

  // Active markdowns total impact
  const markdownImpact = useMemo(() => {
    if (!activeMarkdowns) return 0;
    return activeMarkdowns.reduce((sum, md) => sum + (md.original_price - md.markdown_price), 0);
  }, [activeMarkdowns]);

  const reasonLabels: Record<string, string> = {
    approaching_expiry: 'Approaching Expiry',
    damaged: 'Damaged',
    overstock: 'Overstock',
    promo: 'Promotion',
    manager_directed: 'Manager Directed',
    other: 'Other',
  };

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Pricing & Margins</h1>
        <p className="text-sm text-text-secondary mt-1">Margin analysis, markdowns, and price changes</p>
      </div>

      {/* Margin by Category */}
      <div className="bg-surface rounded-card border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
          Current Margin vs Target by Category
        </h2>
        {marginByCategory.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">
            Not enough pricing data to display margins
          </p>
        ) : (
          <div className="space-y-3">
            {marginByCategory.map((cat) => (
              <div key={cat.category} className="flex items-center gap-4">
                <span className="text-sm text-text-primary w-32 truncate">{cat.category}</span>
                <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden">
                  {/* Target marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-text-secondary/50 z-10"
                    style={{ left: `${Math.min(cat.target, 50)}%` }}
                  />
                  {/* Current bar */}
                  <div
                    className={`h-full rounded-full transition-all ${
                      cat.current >= cat.target ? 'bg-success' : 'bg-warning'
                    }`}
                    style={{ width: `${Math.min(cat.current * 2, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">
                  <span className={cat.current >= cat.target ? 'text-success' : 'text-warning'}>
                    {cat.current}%
                  </span>
                </span>
                <span className="text-xs text-text-secondary w-16">
                  Target: {cat.target}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Markdowns */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-heading font-semibold text-text-primary">
              Active Markdowns
            </h2>
            <span className="text-sm font-medium text-danger">
              -${markdownImpact.toFixed(2)} impact
            </span>
          </div>

          {!activeMarkdowns || activeMarkdowns.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">No active markdowns</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {activeMarkdowns.map((md) => (
                <div
                  key={md.id}
                  className="flex items-center gap-3 p-3 bg-background rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {(md as any).product?.name ?? 'Unknown Product'}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {reasonLabels[md.reason] ?? md.reason}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-danger">
                      ${md.markdown_price.toFixed(2)}
                    </p>
                    <p className="text-xs text-text-secondary line-through">
                      ${md.original_price.toFixed(2)}
                    </p>
                  </div>
                  {!md.approved_by_user_id && (
                    <StatusBadge label="Pending" variant="warning" size="sm" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price Override Audit Trail */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
            Price Change Audit Trail
          </h2>

          {priceAudit.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">No recent price changes</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {priceAudit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-brand-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">
                        {(entry as any).product?.name ?? 'Product'}
                      </span>{' '}
                      set to ${entry.selling_price.toFixed(2)}
                      {entry.cost_price != null && (
                        <span className="text-text-secondary">
                          {' '}(cost: ${entry.cost_price.toFixed(2)})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Effective {format(new Date(entry.effective_date), 'MMM d, yyyy')} &middot;{' '}
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
