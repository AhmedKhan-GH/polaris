import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

// Proves RLS applies through the *app's* db helper (not just raw SQL): a query
// run inside withUserContext acts as app_user with the caller's identity.
describe('withUserContext', () => {
  let container: StartedPostgreSqlContainer
  let appDb: { $client: pg.Pool }
  let orders: typeof import('@/lib/db/schema')['orders']
  let withUserContext: typeof import('@/lib/db/with-user-context')['withUserContext']

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    process.env.DATABASE_URL = container.getConnectionUri()

    const migrationPool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' })
    await migrationPool.end()

    // Import after DATABASE_URL is set.
    const client = await import('@/lib/db/client')
    appDb = client.db as unknown as { $client: pg.Pool }
    orders = (await import('@/lib/db/schema')).orders
    withUserContext = (await import('@/lib/db/with-user-context')).withUserContext

    // Seed as the base (superuser) connection — bypasses RLS.
    await client.db.insert(orders).values([
      { createdBy: USER_A },
      { createdBy: USER_B },
    ])
  }, 60_000)

  afterAll(async () => {
    await appDb?.$client?.end()
    await container?.stop()
  })

  it('a user sees only their own orders', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(orders),
    )
    expect(rows.map((r) => r.createdBy)).toEqual([USER_A])
  })

  it('an owner sees all orders', async () => {
    const rows = await withUserContext({ userId: USER_B, roles: ['owner'] }, (tx) =>
      tx.select().from(orders),
    )
    expect(rows).toHaveLength(2)
  })
})
