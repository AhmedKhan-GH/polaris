import { z } from 'zod'

// Validated server (Node) environment. Fail fast with a clear error at startup
// instead of cryptic `undefined`s deep in the app.
//
// NODE-ONLY: do not import from edge code (proxy.ts / auth.config.ts). A dynamic
// `process.env` parse can't be inlined into the edge bundle, so the edge reads
// its few vars (AUTH_KEYCLOAK_*) directly. SKIP_ENV_VALIDATION lets `next build`
// and other no-runtime contexts skip the check — real values matter at runtime.
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().optional(),
})

export const env = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as z.infer<typeof EnvSchema>)
  : EnvSchema.parse(process.env)
