import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

// This function is triggered when a delivery is logged.
// It auto-resolves any pending restock requests for the same product.

interface DeliveryPayload {
  product_id: string;
  delivered_by_user_id: string;
}

serve(async (req) => {
  try {
    const payload: DeliveryPayload = await req.json();
    const { product_id, delivered_by_user_id } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find unresolved restock requests for this product
    const { data: pendingRestocks, error: fetchError } = await supabase
      .from('stock_events')
      .select('id')
      .eq('product_id', product_id)
      .eq('event_type', 'restock_request')
      .is('resolved_at', null);

    if (fetchError) throw fetchError;

    if (!pendingRestocks || pendingRestocks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending restock requests for this product',
          resolved: 0,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Also resolve any unresolved stockout events for this product
    const { data: pendingStockouts } = await supabase
      .from('stock_events')
      .select('id')
      .eq('product_id', product_id)
      .eq('event_type', 'stockout')
      .is('resolved_at', null);

    const idsToResolve = [
      ...pendingRestocks.map((r: any) => r.id),
      ...(pendingStockouts ?? []).map((s: any) => s.id),
    ];

    // Resolve all pending events
    const { error: updateError } = await supabase
      .from('stock_events')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: delivered_by_user_id,
      })
      .in('id', idsToResolve);

    if (updateError) throw updateError;

    console.log(
      `[AUTO-RESOLVE] Resolved ${idsToResolve.length} stock events for product ${product_id}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        resolved: idsToResolve.length,
        restock_requests: pendingRestocks.length,
        stockouts: pendingStockouts?.length ?? 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
