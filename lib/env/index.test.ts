// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIG = { ...process.env }

afterEach(() => {
  process.env = { ...ORIG }
  vi.resetModules()
})

describe('env', () => {
  it('parses a valid environment', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    process.env.DATABASE_URL = 'postgres://x'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    vi.resetModules()
    const { env } = await import('./index')
    expect(env.DATABASE_URL).toBe('postgres://x')
  })

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    delete process.env.DATABASE_URL
    vi.resetModules()
    await expect(import('./index')).rejects.toThrow()
  })

  it('skips validation when SKIP_ENV_VALIDATION is set', async () => {
    process.env.SKIP_ENV_VALIDATION = '1'
    delete process.env.DATABASE_URL
    vi.resetModules()
    const { env } = await import('./index')
    expect(env.DATABASE_URL).toBeUndefined()
  })

  it('exposes Supabase client + service-role vars', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    process.env.DATABASE_URL = 'postgres://app_user@localhost/db'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    vi.resetModules()
    const { env } = await import('./index')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service-key')
  })
})
