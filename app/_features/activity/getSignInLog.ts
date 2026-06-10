import { desc } from 'drizzle-orm';

import { signInLog } from '@/lib/db/schema/audit';
import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';

/**
 * Read the 100 newest sign-in facts, owner-only at TWO layers (defense in
 * depth): CASL via the registered `read SignInLog` contributor (`withPermission`)
 * AND Postgres RLS via the `app.user_roles` GUC policy that `withUserContext`
 * publishes. Either layer alone refuses a non-owner; both must pass to return a
 * row. The result is capped at the 100 most recent — this is an at-a-glance
 * observability view, never a full export.
 */
export async function getSignInLog(): Promise<
  { id: string; userId: string | null; email: string; createdAt: Date }[]
> {
  return withPermission('read', 'SignInLog', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select()
        .from(signInLog)
        .orderBy(desc(signInLog.createdAt))
        .limit(100),
    ),
  );
}
