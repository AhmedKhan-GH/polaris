import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', 'drizzle')

describe('drizzle migration chain', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    pool = new Pool({ connectionString: container.getConnectionUri() })
  })

  afterAll(async () => {
    await pool?.end()
    await container?.stop()
  })

  test('applies cleanly to an empty database', async () => {
    const db = drizzle(pool)
    await expect(
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    ).resolves.not.toThrow()
  })

  test('creates the orders table with expected columns', async () => {
    const db = drizzle(pool)
    const result = await db.execute<{ column_name: string; data_type: string }>(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
      ORDER BY ordinal_position
    `)
    const columns = Object.fromEntries(
      result.rows.map((r) => [r.column_name, r.data_type])
    )
    expect(columns).toMatchObject({
      id: 'uuid',
      order_number: 'bigint',
      created_at: expect.stringMatching(/timestamp/),
    })
  })

  test('order_number_seq starts at 1000000', async () => {
    const db = drizzle(pool)
    const result = await db.execute<{ nextval: string }>(
      sql`SELECT nextval('order_number_seq')`
    )
    expect(Number(result.rows[0].nextval)).toBe(1_000_000)
  })
})
