import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Runs `fn` inside a transaction that acts as the restricted `app_user` role
// with the caller's identity in session GUCs, so RLS applies to the queries.
// SET LOCAL is transaction-scoped → safe under connection pooling.
//
// All user-scoped DB access should go through this; queries outside it run as
// the base (owner) connection and bypass RLS. Node-only.
export async function withUserContext<T>(
  ctx: { userId: string; roles: string[] },
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role "app_user"`)
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`)
    await tx.execute(
      sql`select set_config('app.user_roles', ${ctx.roles.join(',')}, true)`,
    )
    return fn(tx)
  })
}
