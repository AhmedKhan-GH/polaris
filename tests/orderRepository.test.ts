import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', 'drizzle')

describe('orderRepository', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool
  let repo: typeof import('@/lib/db/orderRepository')
  let appDb: typeof import('@/lib/db')

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()

    // The repository module statically imports lib/db → lib/env, which
    // parses DATABASE_URL through zod at load time. Point it at the
    // container before the first import resolves. Client-side vars are
    // irrelevant here but zod still requires them, so provide stubs.
    process.env.DATABASE_URL = container.getConnectionUri()
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

    pool = new Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })

    repo = await import('@/lib/db/orderRepository')
    appDb = await import('@/lib/db')
  })

  afterAll(async () => {
    // The repo holds an internal pool created in lib/db.ts. If the
    // container is stopped while that pool still has live connections,
    // Postgres terminates them and pg-protocol surfaces an unhandled
    // "administrator command" error. Close the app pool first.
    await appDb?.db.$client.end()
    await pool?.end()
    await container?.stop()
  })

  afterEach(async () => {
    await pool.query('TRUNCATE TABLE orders')
    await pool.query('ALTER SEQUENCE order_number_seq RESTART WITH 1000000')
  })

  test('insertOrder auto-assigns orderNumber from the sequence', async () => {
    const order = await repo.insertOrder({ id: randomUUID() })
    expect(order.orderNumber).toBe(1_000_000)
  })

  test('consecutive inserts produce monotonically increasing orderNumbers', async () => {
    const a = await repo.insertOrder({ id: randomUUID() })
    const b = await repo.insertOrder({ id: randomUUID() })
    const c = await repo.insertOrder({ id: randomUUID() })
    expect([a.orderNumber, b.orderNumber, c.orderNumber]).toEqual([
      1_000_000, 1_000_001, 1_000_002,
    ])
  })

  test('insertOrder populates createdAt server-side when only { id } is passed', async () => {
    const before = Date.now()
    const order = await repo.insertOrder({ id: randomUUID() })
    const after = Date.now()

    expect(order.createdAt).toBeInstanceOf(Date)
    expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1_000)
    expect(order.createdAt.getTime()).toBeLessThanOrEqual(after + 1_000)
  })

  test('findOrderById returns the inserted order', async () => {
    const inserted = await repo.insertOrder({ id: randomUUID() })
    const found = await repo.findOrderById(inserted.id)
    expect(found).toEqual(inserted)
  })

  test('findOrderById returns null for an unknown UUID', async () => {
    const result = await repo.findOrderById(randomUUID())
    expect(result).toBeNull()
  })

  test('findAllOrders returns every inserted row projected through toOrder', async () => {
    const a = await repo.insertOrder({ id: randomUUID() })
    const b = await repo.insertOrder({ id: randomUUID() })

    const all = await repo.findAllOrders()
    expect(all.map((o) => o.id).sort()).toEqual([a.id, b.id].sort())

    for (const order of all) {
      expect(Object.keys(order).sort()).toEqual([
        'createdAt',
        'id',
        'orderNumber',
      ])
    }
  })
})
