import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

describe('database migrations', () => {
  let container: StartedPostgreSqlContainer
  let client: pg.PoolClient
  let pool: pg.Pool

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start()
    pool = new pg.Pool({ connectionString: container.getConnectionUri() })
    client = await pool.connect()

    const migrationPool = new pg.Pool({ connectionString: container.getConnectionUri() })
    const db = drizzle(migrationPool)
    await migrate(db, { migrationsFolder: './drizzle' })
    await migrationPool.end()
  }, 60_000)

  afterAll(async () => {
    client.release()
    await pool.end()
    await container.stop()
  })

  it('creates sign_in_log table with expected columns', async () => {
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sign_in_log'
      ORDER BY ordinal_position
    `)

    expect(result.rows).toEqual([
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'user_id', data_type: 'uuid' },
      { column_name: 'email', data_type: 'text' },
      { column_name: 'success', data_type: 'boolean' },
      { column_name: 'created_at', data_type: 'bigint' },
    ])
  })
})
