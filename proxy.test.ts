import { describe, expect, test, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getRedirectUrl } from 'next/experimental/testing/server'
import { proxy } from './proxy'

const getUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser },
  }),
}))

describe('proxy', () => {
  test('redirects unauthenticated request to /login', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } })

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await proxy(request)

    expect(getRedirectUrl(response!)).toBe('http://localhost:3000/login')
  })

  test('does not redirect unauthenticated request to /login when already on /login', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } })

    const request = new NextRequest('http://localhost:3000/login')
    const response = await proxy(request)

    expect(getRedirectUrl(response!)).toBeNull()
  })

  test('allows authenticated request through', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: '123' } } })

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await proxy(request)

    expect(getRedirectUrl(response!)).toBeNull()
  })

  test('redirects to /login when auth throws (e.g. invalid refresh token)', async () => {
    getUser.mockRejectedValueOnce(new Error('Invalid Refresh Token'))

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await proxy(request)

    expect(getRedirectUrl(response!)).toBe('http://localhost:3000/login')
  })

  test('allows unauthenticated request to landing page', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } })

    const request = new NextRequest('http://localhost:3000/')
    const response = await proxy(request)

    expect(getRedirectUrl(response!)).toBeNull()
  })
})
