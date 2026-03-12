import type { Database, Markdown } from '../types';

type MarkdownInsert = Database['public']['Tables']['markdowns']['Insert'];

// ---------------------------------------------------------------------------
// Create a new markdown entry
// ---------------------------------------------------------------------------
export async function createMarkdown(
  supabase: any,
  data: MarkdownInsert,
): Promise<Markdown> {
  const { data: markdown, error } = await supabase
    .from('markdowns')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return markdown;
}

// ---------------------------------------------------------------------------
// Get currently active markdowns.
// Active means: is_active = true, effective_from <= now, and
// effective_until is either null or in the future.
// ---------------------------------------------------------------------------
export async function getActiveMarkdowns(
  supabase: any,
): Promise<(Markdown & { product: { name: string } | null })[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('markdowns')
    .select('*, product:products(name)')
    .eq('is_active', true)
    .lte('effective_from', now)
    .or(`effective_until.is.null,effective_until.gt.${now}`)
    .order('effective_from', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (Markdown & { product: { name: string } | null })[];
}

// ---------------------------------------------------------------------------
// Approve a markdown (manager action).
// Sets the approved_by_user_id field.
// ---------------------------------------------------------------------------
export async function approveMarkdown(
  supabase: any,
  id: string,
  approvedByUserId: string,
): Promise<Markdown> {
  const { data, error } = await supabase
    .from('markdowns')
    .update({ approved_by_user_id: approvedByUserId })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// End / deactivate a markdown
// ---------------------------------------------------------------------------
export async function endMarkdown(
  supabase: any,
  id: string,
): Promise<Markdown> {
  const { data, error } = await supabase
    .from('markdowns')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Query markdown history with optional filters
// ---------------------------------------------------------------------------
export async function getMarkdownHistory(
  supabase: any,
  filters: {
    productId?: string;
    createdBy?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<Markdown[]> {
  const { productId, createdBy, dateFrom, dateTo } = filters;

  let query = supabase
    .from('markdowns')
    .select('*')
    .order('created_at', { ascending: false });

  if (productId !== undefined) {
    query = query.eq('product_id', productId);
  }
  if (createdBy !== undefined) {
    query = query.eq('created_by_user_id', createdBy);
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
// Get markdowns that are priced below cost and have not yet been approved.
// These require manager approval before they can be active.
// ---------------------------------------------------------------------------
export async function getPendingApprovals(
  supabase: any,
): Promise<(Markdown & { product: { name: string; cost_price: number | null } | null })[]> {
  const { data, error } = await supabase
    .from('markdowns')
    .select('*, product:products(name, cost_price)')
    .eq('is_active', true)
    .is('approved_by_user_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (Markdown & {
    product: { name: string; cost_price: number | null } | null;
  })[];
}
