import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

interface ForecastResult {
  product_id: string;
  product_name: string;
  predicted_daily_demand: number;
  confidence: 'high' | 'medium' | 'low';
  days_of_stock_remaining: number | null;
  reorder_suggested: boolean;
  suggested_order_qty: number | null;
  factors: string[];
}

/**
 * Generates demand forecasts for products based on historical stock events.
 * Uses stockout frequency and restock patterns as demand proxies.
 */
export async function generateDemandForecasts(
  supabase: SupabaseClient<Database>,
  options: { categoryId?: string; daysOfHistory?: number } = {}
): Promise<ForecastResult[]> {
  const { categoryId, daysOfHistory = 30 } = options;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysOfHistory);

  // Get stockout events as demand signal
  let stockoutQuery = supabase
    .from('stock_events')
    .select('product_id, created_at, event_type')
    .in('event_type', ['stockout', 'restock_request'])
    .gte('created_at', sinceDate.toISOString());

  const { data: events, error: eventsError } = await stockoutQuery;
  if (eventsError) throw eventsError;

  // Get products with reorder info
  let productsQuery = supabase
    .from('products')
    .select('id, name, reorder_point, reorder_qty, category_id')
    .eq('is_active', true);

  if (categoryId) {
    productsQuery = productsQuery.eq('category_id', categoryId);
  }

  const { data: products, error: productsError } = await productsQuery;
  if (productsError) throw productsError;

  // Aggregate stockout frequency per product
  const eventCounts: Record<string, { stockouts: number; restocks: number; dates: Date[] }> = {};
  for (const event of events ?? []) {
    if (!eventCounts[event.product_id]) {
      eventCounts[event.product_id] = { stockouts: 0, restocks: 0, dates: [] };
    }
    if (event.event_type === 'stockout') {
      eventCounts[event.product_id].stockouts++;
    } else {
      eventCounts[event.product_id].restocks++;
    }
    eventCounts[event.product_id].dates.push(new Date(event.created_at));
  }

  const forecasts: ForecastResult[] = [];

  for (const product of products ?? []) {
    const counts = eventCounts[product.id];
    if (!counts) continue;

    // Estimate demand based on stockout frequency
    const totalEvents = counts.stockouts + counts.restocks;
    const eventsPerDay = totalEvents / daysOfHistory;
    const predictedDailyDemand = Math.max(eventsPerDay * 5, 1); // rough multiplier

    // Determine confidence based on data volume
    const confidence: 'high' | 'medium' | 'low' =
      totalEvents >= 10 ? 'high' : totalEvents >= 5 ? 'medium' : 'low';

    // Check if reorder is needed
    const reorderSuggested = counts.stockouts >= 3; // 3+ stockouts in period
    const suggestedOrderQty = product.reorder_qty
      ? product.reorder_qty
      : Math.ceil(predictedDailyDemand * 7); // 7-day supply

    const factors: string[] = [];
    if (counts.stockouts >= 5) factors.push('Frequent stockouts detected');
    if (counts.restocks >= 3) factors.push('High restock frequency');

    // Day-of-week pattern
    const dayCounts = new Array(7).fill(0);
    for (const date of counts.dates) {
      dayCounts[date.getDay()]++;
    }
    const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (Math.max(...dayCounts) > totalEvents / 7 * 1.5) {
      factors.push(`Peak demand on ${dayNames[peakDay]}`);
    }

    forecasts.push({
      product_id: product.id,
      product_name: product.name,
      predicted_daily_demand: Math.round(predictedDailyDemand * 10) / 10,
      confidence,
      days_of_stock_remaining: null, // Requires inventory count data
      reorder_suggested: reorderSuggested,
      suggested_order_qty: reorderSuggested ? suggestedOrderQty : null,
      factors,
    });
  }

  // Sort by stockout frequency (most critical first)
  forecasts.sort(
    (a, b) =>
      (eventCounts[b.product_id]?.stockouts ?? 0) -
      (eventCounts[a.product_id]?.stockouts ?? 0)
  );

  return forecasts;
}
