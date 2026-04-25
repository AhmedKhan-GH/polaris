import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.resolve(__dirname)

describe('drizzle migration chain (integration)', () => {
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
      migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    ).resolves.not.toThrow()
  })

  test('order_number_seq starts at 1000000', async () => {
    const db = drizzle(pool)
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

    const result = await db.execute<{ nextval: string }>(
      sql`SELECT nextval('order_number_seq')`,
    )

    expect(Number(result.rows[0].nextval)).toBe(1_000_000)
  })
})
