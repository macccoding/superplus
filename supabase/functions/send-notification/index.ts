import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

interface NotificationPayload {
  type: 'critical_issue' | 'checklist_alert' | 'markdown_approval' | 'stockout';
  title: string;
  message: string;
  target_roles: string[]; // roles that should receive this notification
  data?: Record<string, any>;
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    const { type, title, message, target_roles, data } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get users who should receive the notification
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, role')
      .in('role', target_roles)
      .eq('is_active', true);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    const results: { userId: string; sent: boolean; method: string }[] = [];

    for (const profile of profiles ?? []) {
      // For now, log the notification. In production, integrate with:
      // - Web Push API (via web-push library)
      // - WhatsApp Business API
      // - SMS via Twilio
      // - Email via SendGrid
      console.log(
        `[NOTIFICATION] ${type} -> ${profile.full_name} (${profile.role}): ${title} - ${message}`
      );

      results.push({
        userId: profile.user_id,
        sent: true,
        method: 'log', // Replace with actual delivery method
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: results.length,
        results,
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
