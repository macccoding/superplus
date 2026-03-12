import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

interface MarginAlert {
  product_id: string;
  product_name: string;
  category: string | null;
  current_margin: number;
  target_margin: number;
  drift: number; // percentage points below target
  severity: 'warning' | 'critical';
  reason: string;
  cost_price: number | null;
  selling_price: number;
}

interface MarginSummary {
  total_products_checked: number;
  products_below_target: number;
  alerts: MarginAlert[];
  category_health: CategoryMarginHealth[];
}

interface CategoryMarginHealth {
  category_id: string;
  category_name: string;
  target_margin: number;
  actual_margin: number;
  product_count: number;
  below_target_count: number;
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Scans all active products for margin drift from category targets.
 * Generates alerts when margins fall below acceptable thresholds.
 */
export async function runMarginWatchdog(
  supabase: SupabaseClient<Database>
): Promise<MarginSummary> {
  // Fetch products with categories
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, cost_price, selling_price, target_margin, category_id')
    .eq('is_active', true)
    .not('cost_price', 'is', null);

  if (prodError) throw prodError;

  // Fetch categories with target margins
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, target_margin');

  if (catError) throw catError;

  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.id, c])
  );

  // Check for active markdowns that might affect margins
  const { data: activeMarkdowns } = await supabase
    .from('markdowns')
    .select('product_id, markdown_price')
    .eq('is_active', true);

  const markdownMap = new Map(
    (activeMarkdowns ?? []).map((m) => [m.product_id, m.markdown_price])
  );

  const alerts: MarginAlert[] = [];
  const categoryStats: Record<string, {
    total_margin: number;
    count: number;
    below_target: number;
  }> = {};

  for (const product of products ?? []) {
    if (!product.cost_price || product.cost_price <= 0) continue;

    const effectivePrice = markdownMap.get(product.id) ?? product.selling_price;
    const currentMargin = ((effectivePrice - product.cost_price) / effectivePrice) * 100;

    // Get target margin (product-level > category-level > default 20%)
    const category = product.category_id ? categoryMap.get(product.category_id) : null;
    const targetMargin = (product.target_margin ?? category?.target_margin ?? 0.20) * 100;

    // Track category stats
    if (product.category_id) {
      if (!categoryStats[product.category_id]) {
        categoryStats[product.category_id] = { total_margin: 0, count: 0, below_target: 0 };
      }
      categoryStats[product.category_id].total_margin += currentMargin;
      categoryStats[product.category_id].count++;
      if (currentMargin < targetMargin) {
        categoryStats[product.category_id].below_target++;
      }
    }

    // Check for drift
    const drift = targetMargin - currentMargin;
    if (drift > 0) {
      const severity: 'warning' | 'critical' = drift > 10 || currentMargin < 0 ? 'critical' : 'warning';

      let reason = `Margin ${currentMargin.toFixed(1)}% is ${drift.toFixed(1)}pp below target ${targetMargin.toFixed(1)}%`;
      if (markdownMap.has(product.id)) {
        reason += ' (active markdown)';
      }
      if (currentMargin < 0) {
        reason = `Selling below cost! Margin is ${currentMargin.toFixed(1)}%`;
      }

      alerts.push({
        product_id: product.id,
        product_name: product.name,
        category: category?.name ?? null,
        current_margin: Math.round(currentMargin * 10) / 10,
        target_margin: Math.round(targetMargin * 10) / 10,
        drift: Math.round(drift * 10) / 10,
        severity,
        reason,
        cost_price: product.cost_price,
        selling_price: effectivePrice,
      });
    }
  }

  // Sort alerts by severity then drift
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return b.drift - a.drift;
  });

  // Build category health summary
  const category_health: CategoryMarginHealth[] = [];
  for (const [catId, stats] of Object.entries(categoryStats)) {
    const cat = categoryMap.get(catId);
    if (!cat) continue;

    const actualMargin = stats.count > 0 ? stats.total_margin / stats.count : 0;
    const target = (cat.target_margin ?? 0.20) * 100;
    const belowPct = stats.count > 0 ? (stats.below_target / stats.count) * 100 : 0;

    category_health.push({
      category_id: catId,
      category_name: cat.name,
      target_margin: Math.round(target * 10) / 10,
      actual_margin: Math.round(actualMargin * 10) / 10,
      product_count: stats.count,
      below_target_count: stats.below_target,
      status: belowPct > 50 ? 'critical' : belowPct > 25 ? 'warning' : 'healthy',
    });
  }

  return {
    total_products_checked: products?.length ?? 0,
    products_below_target: alerts.length,
    alerts,
    category_health,
  };
}
