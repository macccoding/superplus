'use client';

import { useEffect } from 'react';
import { createBrowserClient } from './client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from './types';

type TableName = keyof Database['public']['Tables'];

function getSupabase() {
  return createBrowserClient();
}

export function useRealtimeSubscription<T extends TableName>(
  table: T,
  callback: (
    payload: RealtimePostgresChangesPayload<Database['public']['Tables'][T]['Row']>
  ) => void,
  filter?: { column: string; value: string }
) {
  useEffect(() => {
    const channelName = filter
      ? `${table}-${filter.column}-${filter.value}`
      : `${table}-all`;

    let channelConfig: any = {
      event: '*',
      schema: 'public',
      table,
    };

    if (filter) {
      channelConfig.filter = `${filter.column}=eq.${filter.value}`;
    }

    const sb = getSupabase();
    const channel = sb
      .channel(channelName)
      .on('postgres_changes', channelConfig, callback as any)
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value]);
}

export function useRealtimeStockEvents(
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['stock_events']['Row']>) => void
) {
  useRealtimeSubscription('stock_events', onEvent);
}

export function useRealtimeTasks(
  shiftDate: string,
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['tasks']['Row']>) => void
) {
  useRealtimeSubscription('tasks', onEvent, {
    column: 'shift_date',
    value: shiftDate,
  });
}

export function useRealtimeIssues(
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['issues']['Row']>) => void
) {
  useRealtimeSubscription('issues', onEvent);
}

export function useRealtimeChecklists(
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['checklists']['Row']>) => void
) {
  useRealtimeSubscription('checklists', onEvent);
}

export function useRealtimeMarkdowns(
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['markdowns']['Row']>) => void
) {
  useRealtimeSubscription('markdowns', onEvent);
}

export function useRealtimeDailyPrices(
  onEvent: (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['daily_prices']['Row']>) => void
) {
  useRealtimeSubscription('daily_prices', onEvent);
}
