import { describe, expect, test, vi } from 'vitest'

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn((..._args: unknown[]) => ({ tag: 'server' })),
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}))
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
}))

import { getServerSupabase } from './server'

describe('supabase server clients', () => {
  test('getServerSupabase builds a cookie-bound client with the anon key', async () => {
    await getServerSupabase()
    expect(createServerClientMock).toHaveBeenCalledOnce()
    const [url, key] = createServerClientMock.mock.calls[0]
    expect(url).toContain('54321')
    expect(key).toBe('anon-key')
  })
})
