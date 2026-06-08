import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

// Validated server (Node) environment (t3-env). DB-only contexts (db/client,
// logger, integration tests) import this without needing auth vars.
// SKIP_ENV_VALIDATION covers `next build` and no-runtime contexts.
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
