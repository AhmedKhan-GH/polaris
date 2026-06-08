import { beforeEach, describe, expect, test, vi } from 'vitest'

const insertValues = vi.fn()
const warn = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: { insert: () => ({ values: insertValues }) },
}))
vi.mock('@/lib/db/schema', () => ({ signInLog: {} }))
vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => warn(...args) },
}))

import { recordSignIn } from './events'

beforeEach(() => {
  insertValues.mockReset().mockResolvedValue(undefined)
  warn.mockReset()
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

  test('logs a warning when the sign_in_log write fails', async () => {
    insertValues.mockRejectedValueOnce(new Error('db down'))

    await recordSignIn({
      user: { email: 'y@z.com' },
      account: { providerAccountId: 'x' },
    })

    expect(warn).toHaveBeenCalled()
  })

  test('records (does not silently skip) when the message has no user', async () => {
    await recordSignIn({ account: { providerAccountId: 'x' } })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'x', email: '' }),
    )
  })
})
