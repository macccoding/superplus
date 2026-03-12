import { createBrowserClient as createBrowser } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createBrowserClient() {
  return createBrowser<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServerClient(cookieStore: {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: object }[]) => void;
}) {
  // Dynamic import to avoid pulling server-only code into client bundles
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createServerClient: createServer } = require('@supabase/ssr') as typeof import('@supabase/ssr');
  return createServer<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookieStore.setAll(cookiesToSet);
        },
      },
    }
  );
}

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
