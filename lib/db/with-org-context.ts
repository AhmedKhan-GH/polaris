import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { withUserContext } from './with-user-context';

// Sibling of with-user-context.ts's ctxSchema. Deliberately NOT a shared
// validator: userId and orgId are independent fields that happen to both be
// UUIDs, and keeping the two context files decoupled keeps them exchangeable.
// A malformed id must never reach the database, so this is the fail-closed
// gate — same reasoning as with-user-context.ts.
const ctxSchema = z.object({
    userId: z
        .string()
        .regex(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            'userId must be a UUID',
        ),
    orgId: z
        .string()
        .regex(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            'orgId must be a UUID',
        ),
});

/**
 * Runs `fn` inside a transaction whose per-request identity AND org context
 * are published to Postgres via transaction-scoped GUCs, which RLS policies
 * read.
 *
 * This is the tenant-boundary seam: membership is resolved via a real query
 * through withUserContext (so the lookup itself is subject to the existing
 * `member_read` RLS policy on `memberships` — we are not re-implementing
 * trust logic, we are reusing the policy already proven correct in Milestone
 * 1). If the caller has no membership row for `orgId`, this throws before
 * `app.org_id` / `app.org_role` are ever set and before `fn` is ever called.
 * Fail-closed: a thrown error here rolls back the transaction and `fn` never
 * runs.
 */
export async function withOrgContext<T>(
    ctx: { userId: string; orgId: string },
    fn: (tx: Parameters<Parameters<typeof withUserContext>[1]>[0]) => Promise<T>,
): Promise<T> {
    const { userId, orgId } = ctxSchema.parse(ctx);

    // roles: [] — member_read does not gate on app.user_roles (it gates on
    // membership via get_my_org_ids), so platform roles are not load-bearing
    // for this lookup. withUserContext still needs the shape it was given.
    return withUserContext({ userId, roles: [] }, async (tx) => {
        // One query, scoped by RLS: member_read only returns a row if `userId`
        // (already set as app.user_id by withUserContext above) actually has a
        // membership for this org. No row back means "not a member" — we do not
        // and cannot distinguish that from "org doesn't exist", which is the
        // correct fail-closed behaviour for a tenant boundary.
        const result = await tx.execute(
            sql`select role from memberships where org_id = ${orgId} limit 1`,
        );

        const row = result.rows[0];

        if (!row || typeof row.role !== 'string') {
            throw new Error('Not a member');
        }

        const orgRole = row.role;

        // Same set_config(..., true) pattern as withUserContext: scoped to this
        // transaction, pool-safe, auto-cleared on commit/rollback. app.user_id is
        // already set by withUserContext; we add org_id and org_role here so RLS
        // policies downstream (e.g. membership-scoped INSERT policies) can read
        // all three.
        await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
        await tx.execute(
            sql`select set_config('app.org_role', ${orgRole}, true)`,
        );

        return fn(tx);
    });
}