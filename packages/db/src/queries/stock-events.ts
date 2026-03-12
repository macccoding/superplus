import type { Database, StockEvent } from '../types';

type StockEventInsert = Database['public']['Tables']['stock_events']['Insert'];

// ---------------------------------------------------------------------------
// Report a stockout with same-day deduplication.
// If the same product has already been reported today, returns the existing
// event instead of creating a duplicate.
// ---------------------------------------------------------------------------
export async function reportStockout(
  supabase: any,
  params: {
    productId: string;
    reportedByUserId: string;
    notes?: string;
    level?: 'low' | 'empty';
  },
): Promise<StockEvent> {
  const { productId, reportedByUserId, notes, level = 'empty' } = params;

  // Same-day dedup: check if this product already has an unresolved stockout today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing, error: dupError } = await supabase
    .from('stock_events')
    .select('*')
    .eq('product_id', productId)
    .eq('event_type', 'stockout')
    .is('resolved_at', null)
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();

  if (dupError) throw dupError;

  if (existing) {
    return existing;
  }

  const eventNotes = notes
    ? `[${level}] ${notes}`
    : `[${level}]`;

  const { data, error } = await supabase
    .from('stock_events')
    .insert({
      product_id: productId,
      event_type: 'stockout',
      reported_by_user_id: reportedByUserId,
      notes: eventNotes,
    } satisfies StockEventInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get all unresolved stockout events, joined with product name
// ---------------------------------------------------------------------------
export async function getUnresolvedStockouts(
  supabase: any,
): Promise<(StockEvent & { product: { name: string } | null })[]> {
  const { data, error } = await supabase
    .from('stock_events')
    .select('*, product:products(name)')
    .eq('event_type', 'stockout')
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (StockEvent & { product: { name: string } | null })[];
}

// ---------------------------------------------------------------------------
// Mark a stock event as resolved
// ---------------------------------------------------------------------------
export async function resolveStockEvent(
  supabase: any,
  id: string,
  resolvedByUserId: string,
): Promise<StockEvent> {
  const { data, error } = await supabase
    .from('stock_events')
    .update({
      resolved_by_user_id: resolvedByUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Create a restock request event
// ---------------------------------------------------------------------------
export async function createRestockRequest(
  supabase: any,
  params: {
    productId: string;
    reportedByUserId: string;
    assignedTo?: string;
    priority?: string;
  },
): Promise<StockEvent> {
  const { productId, reportedByUserId, assignedTo, priority } = params;

  const notes = [
    assignedTo ? `assigned:${assignedTo}` : null,
    priority ? `priority:${priority}` : null,
  ]
    .filter(Boolean)
    .join(' | ') || null;

  const { data, error } = await supabase
    .from('stock_events')
    .insert({
      product_id: productId,
      event_type: 'restock_request',
      reported_by_user_id: reportedByUserId,
      notes,
    } satisfies StockEventInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Report an expiry / near-expiry flag
// ---------------------------------------------------------------------------
export async function reportExpiry(
  supabase: any,
  params: {
    productId: string;
    reportedByUserId: string;
    expiryDate: string;
    photoUrl?: string;
    notes?: string;
  },
): Promise<StockEvent> {
  const { productId, reportedByUserId, expiryDate, photoUrl, notes } = params;

  const eventNotes = [
    `expiry_date:${expiryDate}`,
    notes ?? null,
  ]
    .filter(Boolean)
    .join(' | ');

  const { data, error } = await supabase
    .from('stock_events')
    .insert({
      product_id: productId,
      event_type: 'expiry_flag',
      reported_by_user_id: reportedByUserId,
      notes: eventNotes,
      photo_url: photoUrl ?? null,
    } satisfies StockEventInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Query stock events with optional filters
// ---------------------------------------------------------------------------
export async function getStockEvents(
  supabase: any,
  filters: {
    eventType?: StockEvent['event_type'];
    productId?: string;
    resolved?: boolean;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<StockEvent[]> {
  const { eventType, productId, resolved, dateFrom, dateTo } = filters;

  let query = supabase
    .from('stock_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (eventType !== undefined) {
    query = query.eq('event_type', eventType);
  }
  if (productId !== undefined) {
    query = query.eq('product_id', productId);
  }
  if (resolved === true) {
    query = query.not('resolved_at', 'is', null);
  } else if (resolved === false) {
    query = query.is('resolved_at', null);
  }
  if (dateFrom !== undefined) {
    query = query.gte('created_at', dateFrom);
  }
  if (dateTo !== undefined) {
    query = query.lte('created_at', dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Count expiry flags created today by a specific user
// ---------------------------------------------------------------------------
export async function getTodayExpiryCount(
  supabase: any,
  userId: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('stock_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'expiry_flag')
    .eq('reported_by_user_id', userId)
    .gte('created_at', todayStart.toISOString());

  if (error) throw error;
  return count ?? 0;
}
