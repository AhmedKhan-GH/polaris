import { beforeEach, describe, expect, test, vi } from 'vitest'

const auth = vi.fn()
const warn = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => warn(...args) },
}))

import { withPermission } from './guard'

const USER = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  auth.mockReset()
  warn.mockReset()
})

describe('withPermission', () => {
  test('runs the action when the role allows it', async () => {
    auth.mockResolvedValue({
      userId: USER,
      roles: ['owner'],
      user: { email: 'o@example.com' },
    })
    const fn = vi.fn().mockResolvedValue('result')

    const out = await withPermission('read', 'SignInLog', fn)

    expect(out).toBe('result')
    expect(fn).toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  test('passes the authenticated userId and roles to the callback', async () => {
    auth.mockResolvedValue({
      userId: USER,
      roles: ['owner'],
      user: { email: 'o@example.com' },
    })
    const fn = vi.fn().mockResolvedValue('ok')

    await withPermission('read', 'SignInLog', fn)

    expect(fn).toHaveBeenCalledWith({ userId: USER, roles: ['owner'] })
  })

  test('throws and logs a denial when the role lacks permission', async () => {
    auth.mockResolvedValue({
      userId: USER,
      roles: ['member'],
      user: { email: 'm@example.com' },
    })
    const fn = vi.fn()

    await expect(withPermission('read', 'SignInLog', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  test('fails closed when there is no authenticated session, even for an otherwise-allowed action', async () => {
    auth.mockResolvedValue(null)
    const fn = vi.fn()

    // create Order is unconditional in the ability — but no session must still deny.
    await expect(withPermission('create', 'Order', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  test('fails closed when the session has no userId', async () => {
    auth.mockResolvedValue({ roles: ['owner'], user: { email: 'o@example.com' } })
    const fn = vi.fn()

    await expect(withPermission('read', 'SignInLog', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })
})
