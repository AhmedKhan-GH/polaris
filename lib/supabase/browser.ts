import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

let client: SupabaseClient | null = null

// Singleton browser client. Realtime params kept modest (used by the live
// orders island).
export function getSupabaseClient(): SupabaseClient {
  if (client) return client
  client = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { realtime: { params: { eventsPerSecond: 10 } } },
  )
  return client
}
