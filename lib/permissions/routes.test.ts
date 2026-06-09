import { describe, expect, test } from 'vitest'
import { canAccessRoute, isPublicPath } from './routes'

describe('route policy', () => {
  test('public paths need no session', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    // No public self-registration — /register is not a route (removed).
    expect(isPublicPath('/register')).toBe(false)
    expect(isPublicPath('/dashboard')).toBe(false)
    expect(isPublicPath('/orders')).toBe(false)
  })

  test('any authenticated role may reach the dashboard for now', () => {
    expect(canAccessRoute('member', '/dashboard')).toBe(true)
    expect(canAccessRoute('owner', '/dashboard')).toBe(true)
  })
})
