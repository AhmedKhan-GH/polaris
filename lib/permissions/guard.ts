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
  const roles = (session as { roles?: string[] } | null)?.roles ?? []

  if (defineAbilityFor(roles).can(action, subject)) {
    return fn()
  }

  const email = (session as { user?: { email?: string | null } } | null)?.user
    ?.email
  logger.warn({ email, roles, action, subject }, 'authorization denied')
  throw new Error('Not authorized')
}
