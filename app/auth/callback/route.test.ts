import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { exchangeCodeForSessionMock, getServerSupabaseMock } = vi.hoisted(
  () => ({
    exchangeCodeForSessionMock: vi.fn(),
    getServerSupabaseMock: vi.fn(),
  }),
)

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: getServerSupabaseMock,
}))

import { GET } from './route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSupabaseMock.mockResolvedValue({
      auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
    })
    exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: null })
  })

  test('exchanges the code for a session and redirects to /', async () => {
    const req = new NextRequest('http://localhost/auth/callback?code=abc123')

    const res = await GET(req)

    expect(getServerSupabaseMock).toHaveBeenCalledTimes(1)
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('abc123')
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  test('skips the exchange and redirects when no code is present', async () => {
    const req = new NextRequest('http://localhost/auth/callback')

    const res = await GET(req)

    expect(getServerSupabaseMock).not.toHaveBeenCalled()
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://localhost/')
  })
})
