import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { signInLog } from '@/lib/db/schema'
import { withPermission } from '@/lib/permissions/guard'

// Owner-only read of the sign-in log. The withPermission guard is the
// enforcement point (CASL + denial logging); the page also redirects
// non-owners for a clean UX.
export function getSignInLog() {
  return withPermission('read', 'SignInLog', () =>
    db
      .select()
      .from(signInLog)
      .orderBy(desc(signInLog.createdAt))
      .limit(100),
  )
}
