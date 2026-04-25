import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', '..', 'drizzle')

type SeedOrder = {
  id: string
  orderNumber: number
  createdAt: Date
}

describe('orderRepository (integration)', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool
  let repo: typeof import('./orderRepository')
  let appDb: typeof import('../db')

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()

    process.env.DATABASE_URL = container.getConnectionUri()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    pool = new Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })

    vi.resetModules()
    repo = await import('./orderRepository')
    appDb = await import('../db')
  })

  afterAll(async () => {
    await appDb?.db.$client.end()
    await pool?.end()
    await container?.stop()
  })

  afterEach(async () => {
    await pool.query('TRUNCATE TABLE orders')
    await pool.query('ALTER SEQUENCE order_number_seq RESTART WITH 1000000')
  })

  async function seedOrder(order: SeedOrder) {
    await pool.query(
      'INSERT INTO orders (id, order_number, created_at) VALUES ($1, $2, $3)',
      [order.id, order.orderNumber, order.createdAt],
    )
  }

  test('insertOrder auto-assigns orderNumber from the sequence', async () => {
    const order = await repo.insertOrder()

    expect(order.orderNumber).toBe(1_000_000)
  })

  test('consecutive inserts produce monotonically increasing orderNumbers', async () => {
    const a = await repo.insertOrder()
    const b = await repo.insertOrder()
    const c = await repo.insertOrder()

    expect([a.orderNumber, b.orderNumber, c.orderNumber]).toEqual([
      1_000_000,
      1_000_001,
      1_000_002,
    ])
  })

  test('insertOrder has the database mint id and createdAt', async () => {
    const before = Date.now()
    const order = await repo.insertOrder()
    const after = Date.now()

    expect(order.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(order.createdAt).toBeInstanceOf(Date)
    expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1_000)
    expect(order.createdAt.getTime()).toBeLessThanOrEqual(after + 1_000)
  })

  test('findOrderById returns the inserted order', async () => {
    const inserted = await repo.insertOrder()

    await expect(repo.findOrderById(inserted.id)).resolves.toEqual(inserted)
  })

  test('findOrderById returns null for an unknown UUID', async () => {
    await expect(
      repo.findOrderById('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeNull()
  })

  test('findAllOrders returns every inserted row projected through the domain shape', async () => {
    const a = await repo.insertOrder()
    const b = await repo.insertOrder()

    const all = await repo.findAllOrders()

    expect(all.map((order) => order.id).sort()).toEqual([a.id, b.id].sort())
    for (const order of all) {
      expect(Object.keys(order).sort()).toEqual([
        'createdAt',
        'id',
        'orderNumber',
      ])
    }
  })

  test('findOrdersPage returns the first page newest-first and respects the limit', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt: new Date('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      createdAt: new Date('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      createdAt: new Date('2026-04-19T12:00:00Z'),
    })

    const page = await repo.findOrdersPage(null, 2)

    expect(page.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002',
    ])
  })

  test('findOrdersPage uses the createdAt and id cursor to continue after tied timestamps', async () => {
    const createdAt = new Date('2026-04-19T12:00:00Z')
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt,
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      createdAt,
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      createdAt,
    })

    const firstPage = await repo.findOrdersPage(null, 2)
    const cursor = {
      createdAt: firstPage[1].createdAt.toISOString(),
      id: firstPage[1].id,
    }

    const secondPage = await repo.findOrdersPage(cursor, 2)

    expect(firstPage.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002',
    ])
    expect(secondPage.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000001',
    ])
  })

  test('countOrders returns the number of rows in the table', async () => {
    await expect(repo.countOrders()).resolves.toBe(0)

    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt: new Date('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      createdAt: new Date('2026-04-19T11:00:00Z'),
    })

    await expect(repo.countOrders()).resolves.toBe(2)
  })
})
