import type { Database, DailyPrice } from '../types';

type DailyPriceInsert = Database['public']['Tables']['daily_prices']['Insert'];

// ---------------------------------------------------------------------------
// Set / upsert a daily price for a product on a given date.
// If a price already exists for this product + date, it is overwritten.
// ---------------------------------------------------------------------------
export async function setDailyPrice(
  supabase: any,
  params: {
    productId: string;
    costPrice?: number;
    sellingPrice: number;
    effectiveDate: string;
    userId: string;
  },
): Promise<DailyPrice> {
  const { productId, costPrice, sellingPrice, effectiveDate, userId } = params;

  // Check if a price entry already exists for this product + date
  const { data: existing, error: lookupError } = await supabase
    .from('daily_prices')
    .select('id')
    .eq('product_id', productId)
    .eq('effective_date', effectiveDate)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    // Update the existing record
    const { data, error } = await supabase
      .from('daily_prices')
      .update({
        cost_price: costPrice ?? null,
        selling_price: sellingPrice,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Insert new record
  const { data, error } = await supabase
    .from('daily_prices')
    .insert({
      product_id: productId,
      cost_price: costPrice ?? null,
      selling_price: sellingPrice,
      effective_date: effectiveDate,
      set_by_user_id: userId,
    } satisfies DailyPriceInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get today's prices joined with product details, ordered by product name.
// ---------------------------------------------------------------------------
export async function getTodayPrices(
  supabase: any,
): Promise<
  (DailyPrice & {
    product: { name: string; category_id: string | null; shelf_location: string | null } | null;
  })[]
> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('daily_prices')
    .select('*, product:products(name, category_id, shelf_location)')
    .eq('effective_date', today)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (DailyPrice & {
    product: { name: string; category_id: string | null; shelf_location: string | null } | null;
  })[];
}

// ---------------------------------------------------------------------------
// Get price history for a specific product with optional date range
// ---------------------------------------------------------------------------
export async function getPriceHistory(
  supabase: any,
  productId: string,
  filters: {
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<DailyPrice[]> {
  const { dateFrom, dateTo } = filters;

  let query = supabase
    .from('daily_prices')
    .select('*')
    .eq('product_id', productId)
    .order('effective_date', { ascending: false });

  if (dateFrom !== undefined) {
    query = query.gte('effective_date', dateFrom);
  }
  if (dateTo !== undefined) {
    query = query.lte('effective_date', dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
