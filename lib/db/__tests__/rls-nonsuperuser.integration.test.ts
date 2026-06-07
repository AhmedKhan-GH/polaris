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

// Faithfully mirrors dev/prod, where the app connects as a NON-SUPERUSER role
// (Supabase's `postgres` is not a superuser). The other integration tests use
// the container's superuser, which masks this: a superuser SET ROLEs freely and
// bypasses RLS. A non-superuser must be a MEMBER of app_user to SET ROLE — that
// membership is per-environment setup (it can't live in a migration: GRANT ...
// TO CURRENT_USER crashes Supabase's Postgres, and the connecting role name
// varies by env). This test grants it the way an env would, then verifies
// withUserContext scopes correctly.
describe('RLS under a non-superuser connection', () => {
  let container: StartedPostgreSqlContainer
  let appDb: { $client: pg.Pool }
  let withUserContext: (typeof import('@/lib/db/with-user-context'))['withUserContext']
  let orders: (typeof import('@/lib/db/schema'))['orders']

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()

    const admin = new pg.Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(admin), { migrationsFolder: './drizzle' })
    // A non-superuser app connection, made a member of app_user (env setup).
    await admin.query(
      `CREATE ROLE app_conn LOGIN PASSWORD 'connpw' NOSUPERUSER`,
    )
    await admin.query(`GRANT "app_user" TO app_conn`)
    // Seed as the superuser admin (owner → bypasses RLS).
    await admin.query(
      `insert into orders (created_by, created_at) values ($1,$2),($3,$4)`,
      [USER_A, 1, USER_B, 2],
    )
    await admin.end()

    process.env.DATABASE_URL = `postgresql://app_conn:connpw@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`
    appDb = (await import('@/lib/db/client')).db as unknown as { $client: pg.Pool }
    withUserContext = (await import('@/lib/db/with-user-context')).withUserContext
    orders = (await import('@/lib/db/schema')).orders
  }, 60_000)

  afterAll(async () => {
    await appDb?.$client?.end()
    await container?.stop()
  })

  it('a non-superuser connection scopes to the user via withUserContext', async () => {
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(orders),
    )
    expect(rows.map((r) => r.createdBy)).toEqual([USER_A])
  })

  it('an owner sees all orders under a non-superuser connection', async () => {
    const rows = await withUserContext(
      { userId: USER_B, roles: ['owner'] },
      (tx) => tx.select().from(orders),
    )
    expect(rows).toHaveLength(2)
  })
})
