import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from './client';

// A malformed id would crash the RLS policy's `::uuid` cast, so it must never
// reach the database — validation here is the fail-closed gate. The `roles`
// array is likewise checked before any DB access.
const ctxSchema = z.object({
  userId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'userId must be a UUID',
    ),
  roles: z.array(z.string()),
});

/**
 * Runs `fn` inside a transaction whose per-request identity is published to
 * Postgres via transaction-scoped GUCs, which the RLS policies read.
 */
export async function withUserContext<T>(
  ctx: { userId: string; roles: string[] },
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const { userId, roles } = ctxSchema.parse(ctx);

  return db.transaction(async (tx) => {
    // The `true` third argument scopes each GUC to this transaction: it is
    // pool-safe and auto-cleared on commit/rollback, so no identity leaks onto
    // a recycled connection. No `SET ROLE` — the app already connects AS
    // `app_user`, the role RLS policies are written against.
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    // Roles are JSON-encoded so a comma inside a role name can never be split
    // into two roles (delimiter-injection guard); policies read this back with
    // `::jsonb @> '["owner"]'`.
    await tx.execute(
      sql`select set_config('app.user_roles', ${JSON.stringify(roles)}, true)`,
    );
    return fn(tx);
  });
}
