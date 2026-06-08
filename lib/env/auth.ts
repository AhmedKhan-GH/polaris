import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

// Validated auth environment (t3-env). Kept SEPARATE from lib/env.ts so DB-only
// contexts (e.g. integration tests that import db/client) don't need auth vars,
// and the edge auth.config doesn't pull in DATABASE_URL.
//
// EDGE-SAFE: `runtimeEnv` maps each var to an explicit `process.env.X` static
// ref, which Next can inline into the edge bundle — so auth.config (edge) can
// import this directly. SKIP_ENV_VALIDATION covers `next build`.
export const authEnv = createEnv({
  server: {
    AUTH_KEYCLOAK_ID: z.string().min(1),
    AUTH_KEYCLOAK_SECRET: z.string().min(1),
    AUTH_KEYCLOAK_ISSUER: z.string().url(),
    AUTH_SECRET: z.string().min(1),
  },
  runtimeEnv: {
    AUTH_KEYCLOAK_ID: process.env.AUTH_KEYCLOAK_ID,
    AUTH_KEYCLOAK_SECRET: process.env.AUTH_KEYCLOAK_SECRET,
    AUTH_KEYCLOAK_ISSUER: process.env.AUTH_KEYCLOAK_ISSUER,
    AUTH_SECRET: process.env.AUTH_SECRET,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
