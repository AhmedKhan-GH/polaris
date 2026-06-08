import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB so we test the identity validation in isolation (no container):
// validation must run BEFORE any DB work.
vi.mock('@/lib/db/client', () => ({ db: { transaction: vi.fn() } }))

import { db } from '@/lib/db/client'
import { withUserContext } from './with-user-context'

const transaction = db.transaction as unknown as ReturnType<typeof vi.fn>
const VALID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  transaction.mockReset()
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ execute: vi.fn() }),
  )
})

describe('withUserContext identity validation', () => {
  it('rejects an empty userId and never touches the DB (fail-closed)', async () => {
    await expect(
      withUserContext({ userId: '', roles: [] }, async () => 'x'),
    ).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a non-uuid userId', async () => {
    await expect(
      withUserContext({ userId: 'not-a-uuid', roles: [] }, async () => 'x'),
    ).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('runs fn for a valid uuid userId', async () => {
    const result = await withUserContext(
      { userId: VALID, roles: ['owner'] },
      async () => 'ok',
    )
    expect(result).toBe('ok')
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
