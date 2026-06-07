import { describe, expect, test } from 'vitest'
import { authRedirect } from './route-guard'

describe('authRedirect', () => {
  test('redirects unauthenticated request away from a protected route', () => {
    expect(authRedirect(false, '/dashboard')).toBe('/login')
  })

  test('does not redirect unauthenticated request already on /login', () => {
    expect(authRedirect(false, '/login')).toBeNull()
  })

  test('allows unauthenticated request to the landing page', () => {
    expect(authRedirect(false, '/')).toBeNull()
  })

  test('allows authenticated request through to a protected route', () => {
    expect(authRedirect(true, '/dashboard')).toBeNull()
  })

  test('redirects authenticated request on /login to /dashboard', () => {
    expect(authRedirect(true, '/login')).toBe('/dashboard')
  })
})
