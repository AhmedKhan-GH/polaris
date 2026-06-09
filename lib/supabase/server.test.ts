import { describe, expect, test, vi } from 'vitest'

const { createServerClientMock, createClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(() => ({ tag: 'server' })),
  createClientMock: vi.fn(() => ({ tag: 'service' })),
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  },
}))
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
}))

import { getServerSupabase, getServiceRoleSupabase } from './server'

describe('supabase server clients', () => {
  test('getServerSupabase builds a cookie-bound client with the anon key', async () => {
    await getServerSupabase()
    expect(createServerClientMock).toHaveBeenCalledOnce()
    const [url, key] = createServerClientMock.mock.calls[0]
    expect(url).toContain('54321')
    expect(key).toBe('anon-key')
  })

  test('getServiceRoleSupabase uses the service-role key, no session persistence', () => {
    getServiceRoleSupabase()
    const [, key, opts] = createClientMock.mock.calls[0]
    expect(key).toBe('service-role-key')
    expect(opts.auth.persistSession).toBe(false)
  })
})
