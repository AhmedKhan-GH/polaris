import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * The browser Supabase client, cached at module scope so the whole client app
 * shares one instance (one realtime socket, one auth session). Lazily created on
 * first call rather than at import so the module stays side-effect free.
 */
let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  client ??= createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Cap realtime to 10 events/sec to bound client-side fan-out from broadcast
    // and presence updates.
    { realtime: { params: { eventsPerSecond: 10 } } },
  );
  return client;
}
