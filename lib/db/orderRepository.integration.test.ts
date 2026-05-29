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
  createdAt: number
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
    await pool.query('TRUNCATE TABLE orders, order_status_history CASCADE')
    await pool.query('UPDATE order_status_counts SET count = 0')
    await pool.query('ALTER SEQUENCE order_number_seq RESTART WITH 1000000')
  })

  async function seedOrder(
    order: SeedOrder & { status?: string },
  ) {
    await pool.query(
      'INSERT INTO orders (id, order_number, status, created_at) VALUES ($1, $2, $3, $4)',
      [order.id, order.orderNumber, order.status ?? 'draft', order.createdAt],
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
    expect(typeof order.createdAt).toBe('number')
    expect(order.createdAt).toBeGreaterThanOrEqual(before - 1_000)
    expect(order.createdAt).toBeLessThanOrEqual(after + 1_000)
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
        'duplicatedFromOrderId',
        'id',
        'isArchived',
        'orderNumber',
        'status',
        'statusUpdatedAt',
      ])
    }
  })

  test('insertOrder defaults status to draft with a fresh statusUpdatedAt', async () => {
    const before = Date.now()
    const order = await repo.insertOrder()
    const after = Date.now()

    expect(order.status).toBe('draft')
    expect(order.duplicatedFromOrderId).toBeNull()
    expect(typeof order.statusUpdatedAt).toBe('number')
    expect(order.statusUpdatedAt).toBeGreaterThanOrEqual(before - 1_000)
    expect(order.statusUpdatedAt).toBeLessThanOrEqual(after + 1_000)
  })

  test('findOrdersPage returns the first page newest-first and respects the limit', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      createdAt: Date.parse('2026-04-19T12:00:00Z'),
    })

    const page = await repo.findOrdersPage(null, 2)

    expect(page.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000002',
    ])
  })

  test('findOrdersPage uses the createdAt and id cursor to continue after tied timestamps', async () => {
    const createdAt = Date.parse('2026-04-19T12:00:00Z')
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
      createdAt: firstPage[1].createdAt,
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

  test('findFilteredOrdersPage filters before paginating', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T09:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000004',
      orderNumber: 1_000_004,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T12:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000005',
      orderNumber: 1_000_005,
      status: 'closed',
      createdAt: Date.parse('2026-04-19T13:00:00Z'),
    })

    const filters = {
      statuses: ['confirmed'] as const,
      createdFrom: Date.parse('2026-04-18T00:00:00Z'),
      createdTo: Date.parse('2026-04-20T23:59:59.999Z'),
    }
    const firstPage = await repo.findFilteredOrdersPage(filters, null, 2)
    const cursor = {
      createdAt: firstPage[1].createdAt,
      id: firstPage[1].id,
    }
    const secondPage = await repo.findFilteredOrdersPage(filters, cursor, 2)

    expect(firstPage.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000003',
    ])
    expect(secondPage.map((order) => order.id)).toEqual([
      '00000000-0000-0000-0000-000000000002',
    ])
  })

  test('countFilteredOrders counts every matching row in the database', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T12:00:00Z'),
    })

    await expect(
      repo.countFilteredOrders({
        statuses: ['confirmed'],
        createdFrom: Date.parse('2026-04-19T00:00:00Z'),
        createdTo: Date.parse('2026-04-19T23:59:59.999Z'),
      }),
    ).resolves.toBe(2)
  })

  test('countFilteredOrdersByStatus groups matching rows by status', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T12:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000004',
      orderNumber: 1_000_004,
      status: 'cancelled',
      createdAt: Date.parse('2026-04-21T12:00:00Z'),
    })

    const counts = await repo.countFilteredOrdersByStatus({
      createdFrom: Date.parse('2026-04-18T00:00:00Z'),
      createdTo: Date.parse('2026-04-20T23:59:59.999Z'),
    })

    expect(counts.confirmed).toBe(2)
    expect(counts.draft).toBe(1)
    expect(counts.cancelled).toBe(0)
  })

  test('countOrders returns the number of rows in the table', async () => {
    await expect(repo.countOrders()).resolves.toBe(0)

    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })

    await expect(repo.countOrders()).resolves.toBe(2)
  })

  test('countOrdersByStatus reads from the trigger-maintained counts table', async () => {
    const a = await repo.insertOrder()
    await repo.insertOrder()
    await repo.transitionOrderStatus({
      orderId: a.id,
      toStatus: 'confirmed',
      changedBy: '11111111-1111-1111-1111-111111111111',
    })

    const counts = await repo.countOrdersByStatus()

    expect(counts.draft).toBe(1)
    expect(counts.confirmed).toBe(1)
    expect(counts.processing).toBe(0)
  })

  test('findOrdersPage returns an empty array when no orders exist', async () => {
    const page = await repo.findOrdersPage(null, 10)
    expect(page).toEqual([])
  })

  test('findOrdersPage returns an empty array when cursor is past the last record', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })

    const cursor = { createdAt: 0, id: '00000000-0000-0000-0000-000000000000' }
    const page = await repo.findOrdersPage(cursor, 10)
    expect(page).toEqual([])
  })

  test('findOrdersPageByStatus only returns orders matching the requested status', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000002',
      orderNumber: 1_000_002,
      status: 'confirmed',
      createdAt: Date.parse('2026-04-19T11:00:00Z'),
    })
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000003',
      orderNumber: 1_000_003,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T12:00:00Z'),
    })

    const page = await repo.findOrdersPageByStatus('draft', null, 10)

    expect(page).toHaveLength(2)
    expect(page.every((o) => o.status === 'draft')).toBe(true)
    expect(page[0].id).toBe('00000000-0000-0000-0000-000000000003')
  })

  test('findFilteredOrdersPage returns empty when no orders match filters', async () => {
    await seedOrder({
      id: '00000000-0000-0000-0000-000000000001',
      orderNumber: 1_000_001,
      status: 'draft',
      createdAt: Date.parse('2026-04-19T10:00:00Z'),
    })

    const page = await repo.findFilteredOrdersPage(
      { statuses: ['confirmed'] },
      null,
      10,
    )
    expect(page).toEqual([])
  })

  test('concurrent transitions on the same order serialize via FOR UPDATE', async () => {
    const order = await repo.insertOrder()

    const results = await Promise.allSettled([
      repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: '11111111-1111-1111-1111-111111111111',
      }),
      repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: '22222222-2222-2222-2222-222222222222',
      }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const final = await repo.findOrderById(order.id)
    expect(final?.status).toBe('confirmed')

    const { rows } = await pool.query(
      'SELECT COUNT(*) as c FROM order_status_history WHERE order_id = $1',
      [order.id],
    )
    expect(Number(rows[0].c)).toBe(1)
  })

  describe('transitionOrderStatus', () => {
    const ACTOR = '11111111-1111-1111-1111-111111111111'

    test('moves draft -> confirmed, updates statusUpdatedAt, writes history', async () => {
      const order = await repo.insertOrder()
      const before = Date.now()
      const updated = await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
        reason: 'ready for fulfillment',
      })

      expect(updated.status).toBe('confirmed')
      expect(updated.statusUpdatedAt).toBeGreaterThanOrEqual(before - 1_000)

      const { rows } = await pool.query(
        'SELECT from_status, to_status, changed_by, reason FROM order_status_history WHERE order_id = $1',
        [order.id],
      )
      expect(rows).toEqual([
        {
          from_status: 'draft',
          to_status: 'confirmed',
          changed_by: ACTOR,
          reason: 'ready for fulfillment',
        },
      ])
    })

    test('rejects a non-adjacent backward transition', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'processing',
        changedBy: ACTOR,
      })

      await expect(
        repo.transitionOrderStatus({
          orderId: order.id,
          toStatus: 'confirmed',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)
    })

    test('rejects a cross-branch transition (draft -> processing)', async () => {
      const order = await repo.insertOrder()
      await expect(
        repo.transitionOrderStatus({
          orderId: order.id,
          toStatus: 'processing',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)
    })

    test('rejects a transition out of a terminal state', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'cancelled',
        changedBy: ACTOR,
      })

      await expect(
        repo.transitionOrderStatus({
          orderId: order.id,
          toStatus: 'confirmed',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)
    })

    test('throws OrderNotFoundError for an unknown id', async () => {
      await expect(
        repo.transitionOrderStatus({
          orderId: '00000000-0000-0000-0000-000000000000',
          toStatus: 'confirmed',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.OrderNotFoundError)
    })

    test('rolls back the history row when the trigger rejects the update', async () => {
      // Defense-in-depth check: even if the app-level guard were skipped,
      // the trigger should reject backward transitions and the surrounding
      // transaction should roll back so no orphan history rows remain.
      const order = await repo.insertOrder()

      await expect(
        pool.query(
          "UPDATE orders SET status = 'closed' WHERE id = $1",
          [order.id],
        ),
      ).rejects.toThrow(/Invalid order status transition/)
    })

    test('a series of valid transitions records the full lifecycle', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'processing',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'fulfilled',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'closed',
        changedBy: ACTOR,
      })

      const { rows } = await pool.query(
        'SELECT from_status, to_status FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC',
        [order.id],
      )
      expect(rows).toEqual([
        { from_status: 'draft', to_status: 'confirmed' },
        { from_status: 'confirmed', to_status: 'processing' },
        { from_status: 'processing', to_status: 'fulfilled' },
        { from_status: 'fulfilled', to_status: 'closed' },
      ])
    })

    test('rejects skipping the fulfilled step (processing -> closed)', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'processing',
        changedBy: ACTOR,
      })

      await expect(
        repo.transitionOrderStatus({
          orderId: order.id,
          toStatus: 'closed',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)
    })

    test('allows confirmed -> draft (reversible transition)', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })
      const reverted = await repo.transitionOrderStatus({
        orderId: order.id,
        toStatus: 'draft',
        changedBy: ACTOR,
        reason: 'needs revision',
      })

      expect(reverted.status).toBe('draft')
    })
  })

  describe('cancelOrder', () => {
    const ACTOR = '22222222-2222-2222-2222-222222222222'

    test('cancels a draft, leaving the row in place for audit', async () => {
      const order = await repo.insertOrder()
      const cancelled = await repo.cancelOrder({
        orderId: order.id,
        changedBy: ACTOR,
      })

      expect(cancelled.status).toBe('cancelled')

      const stillThere = await repo.findOrderById(order.id)
      expect(stillThere?.status).toBe('cancelled')
    })

    test('refuses to cancel a closed order', async () => {
      const order = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: order.id, toStatus: 'confirmed', changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id, toStatus: 'processing', changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id, toStatus: 'fulfilled', changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: order.id, toStatus: 'closed', changedBy: ACTOR,
      })

      await expect(
        repo.cancelOrder({ orderId: order.id, changedBy: ACTOR }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)
    })
  })

  describe('duplicateOrder', () => {
    const ACTOR = '33333333-3333-3333-3333-333333333333'

    test('creates a fresh draft with its own number, linked back to the source', async () => {
      const source = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: source.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })

      const copy = await repo.duplicateOrder({
        sourceOrderId: source.id,
        changedBy: ACTOR,
      })

      expect(copy.id).not.toBe(source.id)
      expect(copy.orderNumber).toBe(source.orderNumber + 1)
      expect(copy.status).toBe('draft')
      expect(copy.duplicatedFromOrderId).toBe(source.id)
    })

    test('leaves the source order untouched in its current state', async () => {
      const source = await repo.insertOrder()
      await repo.transitionOrderStatus({
        orderId: source.id,
        toStatus: 'confirmed',
        changedBy: ACTOR,
      })
      await repo.transitionOrderStatus({
        orderId: source.id,
        toStatus: 'cancelled',
        changedBy: ACTOR,
      })

      await repo.duplicateOrder({
        sourceOrderId: source.id,
        changedBy: ACTOR,
      })

      const reloaded = await repo.findOrderById(source.id)
      expect(reloaded?.status).toBe('cancelled')
    })

    test('works from any source state, including terminal ones', async () => {
      for (const terminal of ['cancelled', 'closed'] as const) {
        const source = await repo.insertOrder()
        if (terminal === 'cancelled') {
          await repo.transitionOrderStatus({
            orderId: source.id, toStatus: 'cancelled', changedBy: ACTOR,
          })
        } else {
          await repo.transitionOrderStatus({
            orderId: source.id, toStatus: 'confirmed', changedBy: ACTOR,
          })
          await repo.transitionOrderStatus({
            orderId: source.id, toStatus: 'processing', changedBy: ACTOR,
          })
          await repo.transitionOrderStatus({
            orderId: source.id, toStatus: 'fulfilled', changedBy: ACTOR,
          })
          await repo.transitionOrderStatus({
            orderId: source.id, toStatus: 'closed', changedBy: ACTOR,
          })
        }

        const copy = await repo.duplicateOrder({
          sourceOrderId: source.id,
          changedBy: ACTOR,
        })
        expect(copy.status).toBe('draft')
        expect(copy.duplicatedFromOrderId).toBe(source.id)
      }
    })

    test('records an initial history row that names the source', async () => {
      const source = await repo.insertOrder()
      const copy = await repo.duplicateOrder({
        sourceOrderId: source.id,
        changedBy: ACTOR,
      })

      const { rows } = await pool.query(
        'SELECT from_status, to_status, reason FROM order_status_history WHERE order_id = $1',
        [copy.id],
      )
      expect(rows).toEqual([
        {
          from_status: null,
          to_status: 'draft',
          reason: `Duplicated from order #${source.orderNumber}`,
        },
      ])
    })

    test('throws OrderNotFoundError for an unknown source', async () => {
      await expect(
        repo.duplicateOrder({
          sourceOrderId: '00000000-0000-0000-0000-000000000000',
          changedBy: ACTOR,
        }),
      ).rejects.toBeInstanceOf(repo.OrderNotFoundError)
    })
  })
})
