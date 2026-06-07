import { db } from '@/lib/db/client'
import { signInLog } from '@/lib/db/schema'

// The message shape Auth.js passes to events.signIn (subset we use).
type SignInMessage = {
  user: { id?: string | null; email?: string | null }
  account?: { providerAccountId?: string | null } | null
  profile?: { sub?: string | null } | null
}

// Best-effort: records a successful sign-in. A DB outage must never block login,
// so failures are swallowed (same contract as the former Supabase signInAction).
//
// The stable Keycloak identity is the `sub`, surfaced as the OIDC account's
// providerAccountId — NOT user.id, which Auth.js generates randomly per sign-in
// when there is no database adapter.
//
// Node-only (pulls node-postgres) — keep out of the edge/proxy graph.
export async function recordSignIn(message: SignInMessage): Promise<void> {
  const sub =
    message.account?.providerAccountId ?? message.profile?.sub ?? null

  try {
    await db.insert(signInLog).values({
      userId: sub,
      email: message.user.email ?? '',
      success: true,
      createdAt: Math.floor(Date.now() / 1000),
    })
  } catch {
    // best-effort — login proceeds even if logging fails
  }
}
