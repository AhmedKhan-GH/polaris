import { z } from 'zod'

// Validated auth environment. Kept SEPARATE from lib/env.ts so DB-only contexts
// (e.g. integration tests that import db/client) don't have to supply auth vars,
// and vice-versa.
//
// NODE-ONLY: do not import from edge code (proxy.ts / auth.config.ts) — a dynamic
// process.env parse can't be inlined into the edge bundle. The edge auth.config
// reads AUTH_KEYCLOAK_* directly (static refs Next can inline); this module is
// the node-side fail-fast check for the same vars (used by the auth actions).
// SKIP_ENV_VALIDATION lets `next build` / no-runtime contexts skip the check.
const AuthEnvSchema = z.object({
  AUTH_KEYCLOAK_ID: z.string().min(1),
  AUTH_KEYCLOAK_SECRET: z.string().min(1),
  AUTH_KEYCLOAK_ISSUER: z.string().url(),
  AUTH_SECRET: z.string().min(1),
})

export const authEnv = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as z.infer<typeof AuthEnvSchema>)
  : AuthEnvSchema.parse(process.env)
