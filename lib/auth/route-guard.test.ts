import { describe, expect, test } from 'vitest'
import { authRedirect } from './route-guard'

describe('authRedirect', () => {
  test('redirects unauthenticated request away from a protected route to the landing page', () => {
    expect(authRedirect(false, '/dashboard')).toBe('/')
  })

  test('allows unauthenticated request to the landing page', () => {
    expect(authRedirect(false, '/')).toBeNull()
  })

  test('allows authenticated request through to a protected route', () => {
    expect(authRedirect(true, '/dashboard')).toBeNull()
  })

  test('allows authenticated request to view the landing page', () => {
    expect(authRedirect(true, '/')).toBeNull()
  })
})
