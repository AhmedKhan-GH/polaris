import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getServerSupabaseMock } = vi.hoisted(() => ({
  getServerSupabaseMock: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ getServerSupabase: getServerSupabaseMock }))

import { getSessionUser } from './session'

function supabaseWith(user: unknown, role: string | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: role ? { role } : null }),
        })),
      })),
    })),
  }
}

describe('getSessionUser', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns null when unauthenticated', async () => {
    getServerSupabaseMock.mockResolvedValue(supabaseWith(null, null))
    expect(await getSessionUser()).toBeNull()
  })

  test('returns userId + email + roles from profiles', async () => {
    getServerSupabaseMock.mockResolvedValue(
      supabaseWith({ id: 'u1', email: 'a@b.com' }, 'owner'),
    )
    expect(await getSessionUser()).toEqual({
      userId: 'u1',
      email: 'a@b.com',
      roles: ['owner'],
    })
  })

  test('defaults roles to [] when there is no profile row', async () => {
    getServerSupabaseMock.mockResolvedValue(
      supabaseWith({ id: 'u1', email: 'a@b.com' }, null),
    )
    expect(await getSessionUser()).toEqual({
      userId: 'u1',
      email: 'a@b.com',
      roles: [],
    })
  })
})
