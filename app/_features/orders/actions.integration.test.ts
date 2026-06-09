import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import pg from 'pg'
import { startRlsTestDb, type RlsTestDb } from '@/lib/db/__tests__/rls-test-db'

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

const authMock = vi.fn()
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => authMock() }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Proves the order actions wire CASL + withUserContext correctly against a real
// DB (session mocked), connecting as a NON-SUPERUSER member of app_user like
// dev/prod. The real Supabase-session wiring is proven by the E2E.
describe('order actions', () => {
  let rls: RlsTestDb
  let appDb: { $client: pg.Pool }
  let createOrder: (typeof import('./actions'))['createOrder']
  let getOrders: (typeof import('./actions'))['getOrders']

  beforeAll(async () => {
    rls = await startRlsTestDb()
    process.env.DATABASE_URL = rls.appConnUri

    appDb = (await import('@/lib/db/client')).db as unknown as { $client: pg.Pool }
    ;({ createOrder, getOrders } = await import('./actions'))
  }, 60_000)

  afterAll(async () => {
    await appDb?.$client?.end()
    await rls?.cleanup()
  })

  it('createOrder inserts a row owned by the current user', async () => {
    authMock.mockResolvedValue({ userId: USER_A, roles: [] })
    await createOrder()

    const rows = await getOrders()
    expect(rows).toHaveLength(1)
    expect(rows[0].createdBy).toBe(USER_A)
  })

  it("getOrders returns only the current user's orders", async () => {
    authMock.mockResolvedValue({ userId: USER_B, roles: [] })
    await createOrder()

    const rows = await getOrders()
    expect(rows.map((r) => r.createdBy)).toEqual([USER_B])
  })

  it('an owner sees all orders', async () => {
    authMock.mockResolvedValue({ userId: USER_B, roles: ['owner'] })

    const rows = await getOrders()
    expect(rows).toHaveLength(2)
  })
})
