import { z } from 'zod'
import { db } from '@/lib/db/client'
import { signInLog } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// The events.signIn payload is external — validate the subset we use rather than
// trusting its shape (a missing `user`, for example, would otherwise crash the
// property access and silently skip the record).
const SignInMessage = z.object({
  user: z.object({ email: z.string().nullish() }).nullish(),
  account: z.object({ providerAccountId: z.string().nullish() }).nullish(),
  profile: z.object({ sub: z.string().nullish() }).nullish(),
})

// Best-effort: records a successful sign-in. A DB outage must never block login,
// so failures are swallowed (same contract as the former Supabase signInAction).
//
// The stable Keycloak identity is the `sub`, surfaced as the OIDC account's
// providerAccountId — NOT user.id, which Auth.js generates randomly per sign-in
// when there is no database adapter.
//
// Node-only (pulls node-postgres) — keep out of the edge/proxy graph.
export async function recordSignIn(message: unknown): Promise<void> {
  const data = SignInMessage.safeParse(message).data
  const sub = data?.account?.providerAccountId ?? data?.profile?.sub ?? null

  try {
    await db.insert(signInLog).values({
      userId: sub,
      email: data?.user?.email ?? '',
      // created_at is set by the DB default. Only successful logins reach here
      // (failures happen at Keycloak), so there's no success flag to record.
    })
  } catch (err) {
    // best-effort — login proceeds even if logging fails, but surface it
    logger.warn({ sub, err }, 'failed to write sign_in_log')
  }
}
