import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'node:path'

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', '..', '..', '..', 'drizzle')

const ACTOR_DEFAULT = '11111111-1111-1111-1111-111111111111'
const ACTOR_TRANSITION = '22222222-2222-2222-2222-222222222222'
const ACTOR_CANCEL = '33333333-3333-3333-3333-333333333333'

const {
  getServerSupabaseMock,
  getUserMock,
  traceMock,
  debugMock,
  infoMock,
  warnMock,
  errorMock,
  fatalMock,
} = vi.hoisted(() => ({
  getServerSupabaseMock: vi.fn(),
  getUserMock: vi.fn(),
  traceMock: vi.fn(),
  debugMock: vi.fn(),
  infoMock: vi.fn(),
  warnMock: vi.fn(),
  errorMock: vi.fn(),
  fatalMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: getServerSupabaseMock,
}))

vi.mock('@/lib/log', () => ({
  log: {
    trace: traceMock,
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    fatal: fatalMock,
  },
}))

describe('orders/data/actions (integration)', () => {
  let container: StartedPostgreSqlContainer
  let pool: Pool
  let actions: typeof import('./actions')
  let repo: typeof import('@/lib/db/orderRepository')
  let appDb: typeof import('@/lib/db')

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()

    process.env.DATABASE_URL = container.getConnectionUri()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    pool = new Pool({ connectionString: container.getConnectionUri() })
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })

    vi.resetModules()
    actions = await import('./actions')
    repo = await import('@/lib/db/orderRepository')
    appDb = await import('@/lib/db')
  })

  afterAll(async () => {
    await appDb?.db.$client.end()
    await pool?.end()
    await container?.stop()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getServerSupabaseMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    })
    getUserMock.mockResolvedValue({ data: { user: { id: ACTOR_DEFAULT } } })
  })

  afterEach(async () => {
    await pool.query('TRUNCATE TABLE orders, order_status_history CASCADE')
    await pool.query('UPDATE order_status_counts SET count = 0')
    await pool.query('ALTER SEQUENCE order_number_seq RESTART WITH 1000000')
  })

  describe('createOrderAction', () => {
    test('persists a fresh draft and returns the new order', async () => {
      const order = await actions.createOrderAction()

      expect(order.status).toBe('draft')
      expect(order.orderNumber).toBe(1_000_000)

      const reloaded = await repo.findOrderById(order.id)
      expect(reloaded?.id).toBe(order.id)
    })

    test('does not consult Supabase (no actor needed for creation)', async () => {
      await actions.createOrderAction()

      expect(getServerSupabaseMock).not.toHaveBeenCalled()
    })
  })

  describe('findOrdersPageAction', () => {
    test('returns the newest-first page from the repository', async () => {
      const a = await actions.createOrderAction()
      const b = await actions.createOrderAction()
      const c = await actions.createOrderAction()

      const page = await actions.findOrdersPageAction(null, 2)

      expect(page.map((o) => o.id)).toEqual([c.id, b.id])
      expect(page.find((o) => o.id === a.id)).toBeUndefined()
    })

    test('respects the cursor for the second page', async () => {
      const a = await actions.createOrderAction()
      const b = await actions.createOrderAction()
      const c = await actions.createOrderAction()

      const first = await actions.findOrdersPageAction(null, 2)
      const cursor = {
        createdAt: first[1].createdAt,
        id: first[1].id,
      }
      const second = await actions.findOrdersPageAction(cursor, 2)

      expect(first.map((o) => o.id)).toEqual([c.id, b.id])
      expect(second.map((o) => o.id)).toEqual([a.id])
    })
  })

  describe('findOrdersPageByStatusAction', () => {
    test('only returns orders matching the requested status', async () => {
      const draft = await actions.createOrderAction()
      const submitted = await actions.createOrderAction()
      await actions.transitionOrderAction({
        orderId: submitted.id,
        toStatus: 'confirmed',
      })

      const drafts = await actions.findOrdersPageByStatusAction('draft', null, 50)
      const submitteds = await actions.findOrdersPageByStatusAction('confirmed', null, 50)

      expect(drafts.map((o) => o.id)).toEqual([draft.id])
      expect(submitteds.map((o) => o.id)).toEqual([submitted.id])
    })
  })

  describe('filtered list actions', () => {
    test('return matching pages and counts from the database', async () => {
      const draft = await actions.createOrderAction()
      const submittedA = await actions.createOrderAction()
      const submittedB = await actions.createOrderAction()
      await actions.transitionOrderAction({
        orderId: submittedA.id,
        toStatus: 'confirmed',
      })
      await actions.transitionOrderAction({
        orderId: submittedB.id,
        toStatus: 'confirmed',
      })
      await pool.query('UPDATE orders SET created_at = $1 WHERE id = $2', [
        Date.parse('2026-04-19T09:00:00Z'),
        draft.id,
      ])
      await pool.query('UPDATE orders SET created_at = $1 WHERE id = $2', [
        Date.parse('2026-04-19T10:00:00Z'),
        submittedA.id,
      ])
      await pool.query('UPDATE orders SET created_at = $1 WHERE id = $2', [
        Date.parse('2026-04-19T11:00:00Z'),
        submittedB.id,
      ])

      const filters = {
        statuses: ['confirmed'] as const,
        createdFrom: Date.parse('2026-04-19T00:00:00Z'),
        createdTo: Date.parse('2026-04-19T23:59:59.999Z'),
      }

      const page = await actions.findFilteredOrdersPageAction(filters, null, 1)
      const count = await actions.countFilteredOrdersAction(filters)
      const countsByStatus =
        await actions.countFilteredOrdersByStatusAction(filters)

      expect(page.map((o) => o.id)).toEqual([submittedB.id])
      expect(count).toBe(2)
      expect(countsByStatus.confirmed).toBe(2)
      expect(countsByStatus.draft).toBe(0)
    })
  })

  describe('countOrdersAction', () => {
    test('returns 0 on an empty table', async () => {
      await expect(actions.countOrdersAction()).resolves.toBe(0)
    })

    test('counts every row regardless of status', async () => {
      await actions.createOrderAction()
      const second = await actions.createOrderAction()
      await actions.transitionOrderAction({
        orderId: second.id,
        toStatus: 'confirmed',
      })

      await expect(actions.countOrdersAction()).resolves.toBe(2)
    })
  })

  describe('countOrdersByStatusAction', () => {
    test('breaks down counts per status', async () => {
      const a = await actions.createOrderAction()
      const b = await actions.createOrderAction()
      await actions.createOrderAction()
      await actions.transitionOrderAction({ orderId: a.id, toStatus: 'confirmed' })
      await actions.cancelOrderAction({ orderId: b.id })

      const counts = await actions.countOrdersByStatusAction()

      expect(counts.draft).toBe(1)
      expect(counts.confirmed).toBe(1)
      expect(counts.cancelled).toBe(1)
    })
  })

  describe('transitionOrderAction', () => {
    test('forwards the resolved actor id to the repository history row', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: ACTOR_TRANSITION } } })
      const order = await actions.createOrderAction()

      await actions.transitionOrderAction({
        orderId: order.id,
        toStatus: 'confirmed',
        reason: 'ready',
      })

      const { rows } = await pool.query(
        'SELECT changed_by, reason FROM order_status_history WHERE order_id = $1',
        [order.id],
      )
      expect(rows).toEqual([{ changed_by: ACTOR_TRANSITION, reason: 'ready' }])
    })

    test('writes a null actor when Supabase has no signed-in user', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } })
      const order = await actions.createOrderAction()

      await actions.transitionOrderAction({
        orderId: order.id,
        toStatus: 'confirmed',
      })

      const { rows } = await pool.query(
        'SELECT changed_by FROM order_status_history WHERE order_id = $1',
        [order.id],
      )
      expect(rows).toEqual([{ changed_by: null }])
    })

    test('logs a warning and rethrows when the repository rejects the transition', async () => {
      const order = await actions.createOrderAction()

      await expect(
        actions.transitionOrderAction({
          orderId: order.id,
          toStatus: 'processing',
        }),
      ).rejects.toBeInstanceOf(repo.InvalidTransitionError)

      expect(warnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(repo.InvalidTransitionError),
          orderId: order.id,
          toStatus: 'processing',
        }),
        'transitionOrderAction rejected',
      )
    })

    test('rethrows OrderNotFoundError for an unknown id', async () => {
      await expect(
        actions.transitionOrderAction({
          orderId: '00000000-0000-0000-0000-000000000000',
          toStatus: 'confirmed',
        }),
      ).rejects.toBeInstanceOf(repo.OrderNotFoundError)
    })
  })

  describe('cancelOrderAction', () => {
    test('marks the order as cancelled and records the actor', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: ACTOR_CANCEL } } })
      const order = await actions.createOrderAction()

      const cancelled = await actions.cancelOrderAction({
        orderId: order.id,
        reason: 'duplicate',
      })

      expect(cancelled.status).toBe('cancelled')
      const { rows } = await pool.query(
        'SELECT changed_by, reason FROM order_status_history WHERE order_id = $1',
        [order.id],
      )
      expect(rows).toEqual([{ changed_by: ACTOR_CANCEL, reason: 'duplicate' }])
    })

    test('logs a warning and rethrows when cancelling a closed order', async () => {
      const order = await actions.createOrderAction()
      await actions.transitionOrderAction({ orderId: order.id, toStatus: 'confirmed' })
      await actions.transitionOrderAction({ orderId: order.id, toStatus: 'processing' })
      await actions.transitionOrderAction({ orderId: order.id, toStatus: 'fulfilled' })
      await actions.transitionOrderAction({ orderId: order.id, toStatus: 'closed' })

      await expect(
        actions.cancelOrderAction({ orderId: order.id }),
      ).rejects.toThrow()

      expect(warnMock).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: order.id }),
        'cancelOrderAction rejected',
      )
    })
  })

  describe('duplicateOrderAction', () => {
    test('creates a fresh draft linked back to the source', async () => {
      const source = await actions.createOrderAction()
      await actions.transitionOrderAction({
        orderId: source.id,
        toStatus: 'confirmed',
      })

      const copy = await actions.duplicateOrderAction({ sourceOrderId: source.id })

      expect(copy.id).not.toBe(source.id)
      expect(copy.status).toBe('draft')
      expect(copy.duplicatedFromOrderId).toBe(source.id)
    })

    test('logs a warning and rethrows for an unknown source id', async () => {
      await expect(
        actions.duplicateOrderAction({
          sourceOrderId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toBeInstanceOf(repo.OrderNotFoundError)

      expect(warnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(repo.OrderNotFoundError),
          sourceOrderId: '00000000-0000-0000-0000-000000000000',
        }),
        'duplicateOrderAction rejected',
      )
    })
  })
})
