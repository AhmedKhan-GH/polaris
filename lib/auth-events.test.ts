import { beforeEach, describe, expect, test, vi } from 'vitest'

const insertValues = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: { insert: () => ({ values: insertValues }) },
}))
vi.mock('@/lib/db/schema', () => ({ signInLog: {} }))

import { recordSignIn } from './auth-events'

beforeEach(() => {
  insertValues.mockReset().mockResolvedValue(undefined)
})

describe('recordSignIn', () => {
  test('keys the row on the Keycloak sub (account.providerAccountId), not user.id', async () => {
    await recordSignIn({
      user: { id: 'random-authjs-id', email: 'test@example.com' },
      account: { providerAccountId: 'kc-sub-aba6' },
    })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'kc-sub-aba6',
        email: 'test@example.com',
        success: true,
        createdAt: expect.any(Number),
      }),
    )
  })

  test('falls back to profile.sub when account is absent', async () => {
    await recordSignIn({
      user: { email: 'test@example.com' },
      profile: { sub: 'kc-sub-prof' },
    })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'kc-sub-prof' }),
    )
  })

  test('is best-effort: swallows DB errors so login is not blocked', async () => {
    insertValues.mockRejectedValueOnce(new Error('db down'))

    await expect(
      recordSignIn({
        user: { email: 'y@z.com' },
        account: { providerAccountId: 'x' },
      }),
    ).resolves.toBeUndefined()
  })
})
