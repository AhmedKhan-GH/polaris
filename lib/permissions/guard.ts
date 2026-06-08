import { auth } from '@/lib/auth'
import { defineAbilityFor } from '@/lib/permissions/ability'
import { logger } from '@/lib/logger'

// Wraps a server action/data fetch with a CASL check based on the current
// session's roles. Runs `fn` when allowed; logs the denial (Pino) and throws
// otherwise. Node-only (imports the NextAuth instance) — not for the edge.
export async function withPermission<T>(
  action: string,
  subject: string,
  fn: () => Promise<T>,
): Promise<T> {
  const session = await auth()
  const userId = (session as { userId?: string } | null)?.userId
  const roles = (session as { roles?: string[] } | null)?.roles ?? []

  // Fail closed: authorization requires an authenticated identity. Don't rely on
  // the ability rules being non-permissive for the unauthenticated case (e.g.
  // `create Order` is unconditional) — assert the session up front.
  if (!userId) {
    logger.warn({ action, subject }, 'authorization denied: no authenticated session')
    throw new Error('Not authenticated')
  }

  // Pass userId so ownership-conditioned rules can be evaluated against
  // subject instances (defense in depth alongside RLS).
  if (defineAbilityFor(roles, userId).can(action, subject)) {
    return fn()
  }

  const email = (session as { user?: { email?: string | null } } | null)?.user
    ?.email
  logger.warn({ email, userId, roles, action, subject }, 'authorization denied')
  throw new Error('Not authorized')
}
