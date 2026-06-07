import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

// Exercises the real recordSignIn writer against a real migrated Postgres,
// so a column/type drift in the insert (or schema) is caught — something the
// mocked-db unit test cannot see.
describe('recordSignIn (integration)', () => {
  let container: StartedPostgreSqlContainer
  let pool: pg.Pool
  let appDb: { $client: pg.Pool }
  let recordSignIn: (typeof import('@/lib/auth-events'))['recordSignIn']

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    process.env.DATABASE_URL = container.getConnectionUri()

    const migrationPool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' })
    await migrationPool.end()

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

    // Import after DATABASE_URL is set — lib/db/client reads it at module load.
    appDb = (await import('@/lib/db/client')).db as unknown as { $client: pg.Pool }
    ;({ recordSignIn } = await import('@/lib/auth-events'))
  }, 60_000)

  afterAll(async () => {
    await pool?.end()
    await appDb?.$client?.end() // close the lib/db/client pool before the container stops
    await container?.stop()
  })

  it('inserts a sign_in_log row keyed by the Keycloak sub', async () => {
    const sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    await recordSignIn({
      user: { id: 'a-random-authjs-id', email: 'test@example.com' },
      account: { providerAccountId: sub },
    })

    const { rows } = await pool.query(
      'select user_id, email, success from sign_in_log',
    )
    expect(rows).toEqual([
      { user_id: sub, email: 'test@example.com', success: true },
    ])
  })
})
