import { beforeEach, describe, expect, test, vi } from 'vitest'

const auth = vi.fn()
const warn = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => warn(...args) },
}))

import { withPermission } from './guard'

beforeEach(() => {
  auth.mockReset()
  warn.mockReset()
})

describe('withPermission', () => {
  test('runs the action when the role allows it', async () => {
    auth.mockResolvedValue({ roles: ['owner'], user: { email: 'o@example.com' } })
    const fn = vi.fn().mockResolvedValue('result')

    const out = await withPermission('read', 'SignInLog', fn)

    expect(out).toBe('result')
    expect(fn).toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  test('throws and logs a denial when the role lacks permission', async () => {
    auth.mockResolvedValue({ roles: ['member'], user: { email: 'm@example.com' } })
    const fn = vi.fn()

    await expect(withPermission('read', 'SignInLog', fn)).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })
})
