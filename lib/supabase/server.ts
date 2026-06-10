import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';

/**
 * A request-scoped Supabase client for server contexts (Server Components,
 * Server Actions, Route Handlers). It reads and writes the session via Next's
 * request cookie store, so `@supabase/ssr` can rotate auth tokens transparently.
 *
 * `cookies()` is async in Next 16, so this factory is async too. Each call is
 * bound to the current request — never cache or hoist the returned client.
 */
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; the refresh is harmlessly
            // dropped here and reissued by the middleware/proxy on the next
            // request, which owns session refresh.
          }
        },
      },
    },
  );
}
