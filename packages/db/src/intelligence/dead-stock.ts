import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

interface DeadStockItem {
  product_id: string;
  product_name: string;
  category: string | null;
  selling_price: number;
  cost_price: number | null;
  days_since_last_activity: number;
  total_events_90d: number;
  recommendation: 'markdown' | 'discontinue' | 'relocate' | 'bundle';
  reason: string;
  estimated_value_at_cost: number | null;
}

interface DeadStockReport {
  analyzed_products: number;
  dead_stock_count: number;
  slow_mover_count: number;
  total_value_at_cost: number;
  items: DeadStockItem[];
}

/**
 * Identifies slow-moving and dead stock based on stock event activity.
 * Products with no activity (stockouts, restocks) in the analysis period
 * are flagged as potential dead stock.
 */
export async function detectDeadStock(
  supabase: SupabaseClient<Database>,
  options: {
    deadThresholdDays?: number;    // No activity for this many days = dead
    slowThresholdDays?: number;    // Low activity threshold
    minEventsForActive?: number;   // Minimum events in 90 days to be "active"
  } = {}
): Promise<DeadStockReport> {
  const {
    deadThresholdDays = 60,
    slowThresholdDays = 30,
    minEventsForActive = 3,
  } = options;

  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get all active products
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, selling_price, cost_price, category_id')
    .eq('is_active', true);

  if (prodError) throw prodError;

  // Get categories for names
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name');

  const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

  // Get all stock events in last 90 days
  const { data: events, error: evError } = await supabase
    .from('stock_events')
    .select('product_id, created_at')
    .gte('created_at', ninetyDaysAgo.toISOString());

  if (evError) throw evError;

  // Aggregate events per product
  const activity: Record<string, { count: number; lastDate: Date }> = {};
  for (const event of events ?? []) {
    if (!activity[event.product_id]) {
      activity[event.product_id] = { count: 0, lastDate: new Date(0) };
    }
    activity[event.product_id].count++;
    const eventDate = new Date(event.created_at);
    if (eventDate > activity[event.product_id].lastDate) {
      activity[event.product_id].lastDate = eventDate;
    }
  }

  const items: DeadStockItem[] = [];
  let totalValueAtCost = 0;

  for (const product of products ?? []) {
    const productActivity = activity[product.id];
    const eventCount = productActivity?.count ?? 0;
    const lastActivity = productActivity?.lastDate ?? new Date(0);
    const daysSinceLast = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Skip products with sufficient activity
    if (eventCount >= minEventsForActive && daysSinceLast < slowThresholdDays) {
      continue;
    }

    const isDead = daysSinceLast >= deadThresholdDays || eventCount === 0;
    const estimatedValue = product.cost_price ? product.cost_price * 10 : null; // Assume ~10 units

    let recommendation: DeadStockItem['recommendation'];
    let reason: string;

    if (isDead) {
      if (product.cost_price && product.selling_price > product.cost_price * 1.5) {
        recommendation = 'markdown';
        reason = `No activity in ${daysSinceLast} days. High margin allows aggressive markdown.`;
      } else {
        recommendation = 'discontinue';
        reason = `No activity in ${daysSinceLast} days. Consider removing from inventory.`;
      }
    } else {
      if (eventCount < minEventsForActive) {
        recommendation = 'relocate';
        reason = `Only ${eventCount} events in 90 days. May benefit from better shelf placement.`;
      } else {
        recommendation = 'bundle';
        reason = `Slowing demand (${eventCount} events in 90 days). Consider bundling with popular items.`;
      }
    }

    if (estimatedValue) totalValueAtCost += estimatedValue;

    items.push({
      product_id: product.id,
      product_name: product.name,
      category: product.category_id ? catMap.get(product.category_id) ?? null : null,
      selling_price: product.selling_price,
      cost_price: product.cost_price,
      days_since_last_activity: daysSinceLast,
      total_events_90d: eventCount,
      recommendation,
      reason,
      estimated_value_at_cost: estimatedValue,
    });
  }

  // Sort: dead stock first, then by days since activity descending
  items.sort((a, b) => b.days_since_last_activity - a.days_since_last_activity);

  return {
    analyzed_products: products?.length ?? 0,
    dead_stock_count: items.filter((i) => i.days_since_last_activity >= deadThresholdDays).length,
    slow_mover_count: items.filter((i) => i.days_since_last_activity < deadThresholdDays).length,
    total_value_at_cost: Math.round(totalValueAtCost * 100) / 100,
    items,
  };
}
