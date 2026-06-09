import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

// Validated server (Node) environment (t3-env). DB-only contexts (db/client,
// logger, integration tests) import this without needing auth vars.
// SKIP_ENV_VALIDATION covers `next build` and no-runtime contexts.
export const env = createEnv({
  // NOTE: SUPABASE_SERVICE_ROLE_KEY is intentionally NOT declared here. No in-app
  // code consumes it (registration was removed), and the only reader — the E2E
  // harness's user seeding — reads process.env directly. Declaring it would force
  // the app to require a key it never uses at boot. Re-add at F9 (invite-code
  // provisioning), when in-app code actually uses the service role.
  server: {
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
