import { getSessionUser } from '@/lib/auth/session'
import { defineAbilityFor } from '@/lib/permissions/ability'
import { logger } from '@/lib/logger'

// Wraps a server action/data fetch with a CASL check based on the current
// session's roles. Runs `fn` when allowed; logs the denial (Pino) and throws
// otherwise. Node-only (imports the NextAuth instance) — not for the edge.
export async function withPermission<T>(
  action: string,
  subject: string,
  fn: (ctx: { userId: string; roles: string[] }) => Promise<T>,
): Promise<T> {
  const session = await getSessionUser()
  const userId = session?.userId
  const roles = session?.roles ?? []

  // Fail closed: authorization requires an authenticated identity. Don't rely on
  // the ability rules being non-permissive for the unauthenticated case (e.g.
  // `create Order` is unconditional) — assert the session up front.
  if (!userId) {
    logger.warn({ action, subject }, 'authorization denied: no authenticated session')
    throw new Error('Not authenticated')
  }

  // Resolve the session ONCE and hand the identity to fn — callers no longer
  // re-fetch it. userId also lets ownership-conditioned rules evaluate against
  // subject instances (defense in depth alongside RLS).
  if (defineAbilityFor(roles, userId).can(action, subject)) {
    return fn({ userId, roles })
  }

  logger.warn(
    { email: session?.email, userId, roles, action, subject },
    'authorization denied',
  )
  throw new Error('Not authorized')
}
