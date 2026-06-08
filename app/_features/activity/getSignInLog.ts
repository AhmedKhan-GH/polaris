import { desc } from 'drizzle-orm'
import { signInLog } from '@/lib/db/schema'
import { withUserContext } from '@/lib/db/with-user-context'
import { withPermission } from '@/lib/permissions/guard'

// Owner-only read of the sign-in log, enforced at TWO layers: withPermission
// (CASL + denial logging) AND RLS (the owner-role policy on sign_in_log). The
// read runs through withUserContext so the role GUC is set for the policy;
// withPermission supplies the identity (no separate auth() call).
export function getSignInLog() {
  return withPermission('read', 'SignInLog', ({ userId, roles }) =>
    withUserContext({ userId, roles }, (tx) =>
      tx.select().from(signInLog).orderBy(desc(signInLog.createdAt)).limit(100),
    ),
  )
}
