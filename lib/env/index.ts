import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Validated, typed environment access. Fails closed at import time: an invalid
 * value (e.g. an out-of-range `LOG_LEVEL`) throws before any code can read it.
 * Set `SKIP_ENV_VALIDATION` to bypass validation (e.g. for lint/typecheck in CI
 * where real values are absent).
 */
export const env = createEnv({
  server: {
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .optional(),
    // Runtime connection string for the non-superuser app role. Required: the
    // app cannot start without a database. `MIGRATE_DATABASE_URL` is deliberately
    // NOT validated here — it is consumed only by drizzle.config.ts at CLI time
    // (Charter D1 build-time exception), never by running application code.
    DATABASE_URL: z.string().min(1),
    GOOGLE_MAPS_SERVER_KEY: z.string().min(1),
  },
  client: {
    // Browser-exposed Supabase project endpoint and anon key. Both are required
    // for the SSR/browser clients to construct; an invalid URL or empty key
    // fails closed at import time (same fail-closed contract as the server vars).
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    LOG_LEVEL: process.env.LOG_LEVEL,
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_MAPS_SERVER_KEY: process.env.GOOGLE_MAPS_SERVER_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
