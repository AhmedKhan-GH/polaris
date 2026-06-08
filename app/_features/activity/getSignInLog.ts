import { desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { signInLog } from '@/lib/db/schema'
import { withUserContext } from '@/lib/db/with-user-context'
import { withPermission } from '@/lib/permissions/guard'

// Owner-only read of the sign-in log, enforced at TWO layers: withPermission
// (CASL + denial logging) AND RLS (the owner-role policy on sign_in_log). The
// read runs through withUserContext so the role GUC is set for the policy.
export function getSignInLog() {
  return withPermission('read', 'SignInLog', async () => {
    const session = await auth()
    const userId = (session as { userId?: string } | null)?.userId
    const roles = (session as { roles?: string[] } | null)?.roles ?? []
    if (!userId) throw new Error('Not authenticated')

    return withUserContext({ userId, roles }, (tx) =>
      tx.select().from(signInLog).orderBy(desc(signInLog.createdAt)).limit(100),
    )
  })
}
