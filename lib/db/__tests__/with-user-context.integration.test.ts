import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { startRlsTestDb, type RlsTestDb } from './rls-test-db'

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

// Runs as a NON-SUPERUSER member of app_user (via startRlsTestDb), mirroring
// dev/prod — so RLS and the SET ROLE membership requirement are exercised for
// real, not masked by a superuser connection.
describe('withUserContext', () => {
  let rls: RlsTestDb
  let appDb: { $client: pg.Pool }
  let orders: (typeof import('@/lib/db/schema'))['orders']
  let withUserContext: (typeof import('@/lib/db/with-user-context'))['withUserContext']

  beforeAll(async () => {
    rls = await startRlsTestDb()
    // Seed as the superuser admin (owner → bypasses RLS).
    await rls.admin.query(`insert into orders (created_by) values ($1),($2)`, [
      USER_A,
      USER_B,
    ])

    process.env.DATABASE_URL = rls.appConnUri
    appDb = (await import('@/lib/db/client')).db as unknown as { $client: pg.Pool }
    orders = (await import('@/lib/db/schema')).orders
    withUserContext = (await import('@/lib/db/with-user-context')).withUserContext
  }, 60_000)

  afterAll(async () => {
    await appDb?.$client?.end()
    await rls?.cleanup()
  })

  it('a user sees only their own orders', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(orders),
    )
    expect(rows.map((r) => r.createdBy)).toEqual([USER_A])
  })

  it('an owner sees all orders', async () => {
    const rows = await withUserContext(
      { userId: USER_B, roles: ['owner'] },
      (tx) => tx.select().from(orders),
    )
    expect(rows).toHaveLength(2)
  })
})
