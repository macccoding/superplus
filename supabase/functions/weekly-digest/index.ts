import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString();

    // Fetch new suggestions from the past week
    const { data: suggestions, error: sugError } = await supabase
      .from('suggestions')
      .select('*')
      .gte('created_at', weekAgoStr)
      .order('created_at', { ascending: false });

    if (sugError) throw sugError;

    // Fetch weekly stats
    const { count: stockoutCount } = await supabase
      .from('stock_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'stockout')
      .gte('created_at', weekAgoStr);

    const { count: issueCount } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoStr);

    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('created_at', weekAgoStr);

    const { count: checklistCount } = await supabase
      .from('checklists')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', weekAgoStr);

    // Build digest
    const digest = {
      period: {
        from: weekAgoStr,
        to: new Date().toISOString(),
      },
      stats: {
        stockouts: stockoutCount ?? 0,
        issues_reported: issueCount ?? 0,
        tasks_completed: taskCount ?? 0,
        checklists_completed: checklistCount ?? 0,
      },
      suggestions: {
        total: suggestions?.length ?? 0,
        by_category: (suggestions ?? []).reduce(
          (acc: Record<string, number>, s: any) => {
            acc[s.category] = (acc[s.category] || 0) + 1;
            return acc;
          },
          {}
        ),
        items: (suggestions ?? []).map((s: any) => ({
          message: s.message,
          category: s.category,
          date: s.created_at,
        })),
      },
    };

    // Get management users for the digest
    const { data: managers } = await supabase
      .from('profiles')
      .select('user_id, full_name, role')
      .in('role', ['owner', 'manager'])
      .eq('is_active', true);

    // In production, send via email (SendGrid/Resend).
    // For now, log the digest.
    console.log('[WEEKLY DIGEST]', JSON.stringify(digest, null, 2));
    console.log(`Would send to: ${(managers ?? []).map((m: any) => m.full_name).join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        digest,
        recipients: managers?.length ?? 0,
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
