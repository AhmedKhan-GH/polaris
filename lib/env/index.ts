import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

// Validated server (Node) environment (t3-env). DB-only contexts (db/client,
// logger, integration tests) import this without needing auth vars.
// SKIP_ENV_VALIDATION covers `next build` and no-runtime contexts.
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.string().optional(),
    // No in-app consumer today (registration was removed); kept for the E2E
    // harness's user seeding and future F9 invite-code provisioning.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
