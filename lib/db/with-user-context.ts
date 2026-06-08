import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`)
    await tx.execute(
      sql`select set_config('app.user_roles', ${ctx.roles.join(',')}, true)`,
    )
    return fn(tx)
  })
}
