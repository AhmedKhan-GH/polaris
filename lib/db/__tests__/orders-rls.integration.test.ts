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

describe('orders RLS (own OR owner)', () => {
  let container: StartedPostgreSqlContainer
  let pool: pg.Pool
  let client: pg.PoolClient

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    pool = new pg.Pool({ connectionString: container.getConnectionUri() })

    const migrationPool = new pg.Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' })
    await migrationPool.end()

    client = await pool.connect()
    // Seed as the migration/owner connection (superuser → bypasses RLS).
    await client.query(`insert into orders (created_by) values ($1), ($2)`, [
      USER_A,
      USER_B,
    ])
  }, 60_000)

  afterAll(async () => {
    client?.release()
    await pool?.end()
    await container?.stop()
  })

  // Act as the restricted role with a given identity (RLS applies).
  async function asUser(userId: string, roles: string) {
    await client.query('set role app_user')
    await client.query(`select set_config('app.user_id', $1, false)`, [userId])
    await client.query(`select set_config('app.user_roles', $1, false)`, [roles])
  }
  async function asSuperuser() {
    await client.query('reset role')
  }

  it('a user sees only their own orders', async () => {
    await asUser(USER_A, '')
    const { rows } = await client.query('select created_by from orders')
    await asSuperuser()
    expect(rows).toEqual([{ created_by: USER_A }])
  })

  it("a user cannot see another user's orders", async () => {
    await asUser(USER_B, '')
    const { rows } = await client.query(
      'select created_by from orders where created_by = $1',
      [USER_A],
    )
    await asSuperuser()
    expect(rows).toEqual([])
  })

  it('an owner sees all orders', async () => {
    await asUser(USER_B, 'owner')
    const { rows } = await client.query('select created_by from orders')
    await asSuperuser()
    expect(rows).toHaveLength(2)
  })

  it('the owner/migration connection bypasses RLS', async () => {
    await asSuperuser()
    const { rows } = await client.query('select created_by from orders')
    expect(rows).toHaveLength(2)
  })
})
