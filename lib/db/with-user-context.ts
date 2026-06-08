import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Fail-closed: a missing/invalid identity must never reach the DB. An empty or
// malformed userId would otherwise be cast by the RLS policy
// (`current_setting('app.user_id')::uuid`) and crash the query. Dashed-hex form
// (what Keycloak emits / Postgres accepts) — looser than strict RFC-4122.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ContextSchema = z.object({
  userId: z.string().regex(UUID, 'userId must be a UUID'),
  roles: z.array(z.string()),
})

// Runs `fn` inside a transaction with the caller's identity in session GUCs, so
// RLS applies to the queries. The app connects AS the non-superuser `app_user`
// role (see DATABASE_URL), so `current_user = app_user` and the policy applies
// natively — no SET ROLE needed. SET LOCAL is transaction-scoped → pool-safe.
//
// All user-scoped DB access should go through this. Node-only.
export async function withUserContext<T>(
  ctx: { userId: string; roles: string[] },
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  const { userId, roles } = ContextSchema.parse(ctx)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    await tx.execute(
      sql`select set_config('app.user_roles', ${roles.join(',')}, true)`,
    )
    return fn(tx)
  })
}
