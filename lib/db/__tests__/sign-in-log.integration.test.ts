import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

// Exercises the real sign_in_log insert (the one signInAction performs on a
// successful login) against a real migrated Postgres, so a column/type drift in
// the insert (or schema) is caught — something the mocked-db unit test cannot see.
describe('sign_in_log insert (integration)', () => {
  let container: StartedPostgreSqlContainer
  let pool: pg.Pool
  let db: typeof import('@/lib/db/client')['db']
  let signInLog: typeof import('@/lib/db/schema')['signInLog']

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    process.env.DATABASE_URL = container.getConnectionUri()

    const migrationPool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' })
    await migrationPool.end()

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

    // Import after DATABASE_URL is set — lib/db/client reads it at module load.
    db = (await import('@/lib/db/client')).db
    ;({ signInLog } = await import('@/lib/db/schema'))
  }, 60_000)

  afterAll(async () => {
    await pool?.end()
    await (db as unknown as { $client: pg.Pool })?.$client?.end()
    await container?.stop()
  })

  it('inserts a sign_in_log row keyed by the auth user id (sub)', async () => {
    const sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    await db.insert(signInLog).values({ userId: sub, email: 'test@example.com' })

    const { rows } = await pool.query('select user_id, email from sign_in_log')
    expect(rows).toEqual([{ user_id: sub, email: 'test@example.com' }])
  })
})
