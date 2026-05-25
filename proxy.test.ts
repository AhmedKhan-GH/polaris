import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.hoisted(() => vi.fn())
const singleMock = vi.hoisted(() => vi.fn())

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}))

vi.mock('./lib/env', () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  },
}))

import { proxy } from './proxy'

describe('proxy middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('allows authenticated users through to any route', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    singleMock.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/orders')
    const res = await proxy(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  test('redirects unauthenticated users to /login', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/orders')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  test('allows unauthenticated access to /login', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/login')
    const res = await proxy(req)

    expect(res.status).toBe(200)
  })

  test('allows unauthenticated access to /register', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/register')
    const res = await proxy(req)

    expect(res.status).toBe(200)
  })

  test('does not treat /login-admin as a public route', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/login-admin')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  test('does not treat /register-admin as a public route', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const req = new NextRequest('http://localhost:3000/register-admin')
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  test('clears sb-* cookies on refresh_token_not_found error', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { code: 'refresh_token_not_found' },
    })

    const req = new NextRequest('http://localhost:3000/orders')
    req.cookies.set('sb-access-token', 'stale')
    req.cookies.set('sb-refresh-token', 'stale')
    req.cookies.set('other-cookie', 'keep')

    const res = await proxy(req)

    expect(res.status).toBe(307)

    const setCookies = res.headers.getSetCookie()
    const expired = setCookies.filter((c) => c.includes('Expires=Thu, 01 Jan 1970'))
    const expiredNames = expired.map((c) => c.split('=')[0])

    expect(expiredNames).toContain('sb-access-token')
    expect(expiredNames).toContain('sb-refresh-token')
    expect(expiredNames).not.toContain('other-cookie')
  })

  test('does not clear cookies on other auth errors', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { code: 'session_not_found' },
    })

    const req = new NextRequest('http://localhost:3000/orders')
    req.cookies.set('sb-access-token', 'stale')

    const res = await proxy(req)

    expect(res.status).toBe(307)
    const setCookies = res.headers.getSetCookie()
    const expired = setCookies.filter((c) => c.includes('Expires=Thu, 01 Jan 1970'))
    expect(expired).toHaveLength(0)
  })
})
