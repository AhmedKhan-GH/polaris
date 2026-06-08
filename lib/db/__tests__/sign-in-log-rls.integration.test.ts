import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const SEED_SUB = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SEED_EMAIL = 'seed@example.com'

// sign_in_log is a global admin log (no per-row owner): only the `owner` role
// may read it, but inserts must stay unrestricted so recordSignIn can log every
// sign-in (it runs as app_user with no user session/GUC).
describe('sign_in_log RLS (owner-only read, unrestricted insert)', () => {
  let container: StartedPostgreSqlContainer
  let pool: pg.Pool
  let client: pg.PoolClient

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    pool = new pg.Pool({ connectionString: container.getConnectionUri() })

    const migrationPool = new pg.Pool({
      connectionString: container.getConnectionUri(),
    })
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' })
    await migrationPool.end()

    client = await pool.connect()
    // Seed as the superuser/migration connection (bypasses RLS).
    await client.query(
      `insert into sign_in_log (user_id, email) values ($1, $2)`,
      [SEED_SUB, SEED_EMAIL],
    )
  }, 60_000)

  afterAll(async () => {
    client?.release()
    await pool?.end()
    await container?.stop()
  })

  async function asUser(roles: string[]) {
    await client.query('set role app_user')
    await client.query(`select set_config('app.user_roles', $1, false)`, [
      JSON.stringify(roles),
    ])
  }
  async function asSuperuser() {
    await client.query('reset role')
  }

  it('a non-owner cannot read the sign-in log', async () => {
    await asUser(['member'])
    const { rows } = await client.query(
      'select email from sign_in_log where email = $1',
      [SEED_EMAIL],
    )
    await asSuperuser()
    expect(rows).toEqual([])
  })

  it('an owner can read the sign-in log', async () => {
    await asUser(['owner'])
    const { rows } = await client.query(
      'select email from sign_in_log where email = $1',
      [SEED_EMAIL],
    )
    await asSuperuser()
    expect(rows).toEqual([{ email: SEED_EMAIL }])
  })

  it('app_user can insert without an owner role (recordSignIn path)', async () => {
    await asUser([])
    await client.query(
      `insert into sign_in_log (user_id, email) values ($1, $2)`,
      ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'written@example.com'],
    )
    await asSuperuser()
    const { rows } = await client.query(
      'select email from sign_in_log where email = $1',
      ['written@example.com'],
    )
    expect(rows).toEqual([{ email: 'written@example.com' }])
  })
})
