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
    vi.resetModules()
    const { env } = await import('./env')
    expect(env.DATABASE_URL).toBe('postgres://x')
  })

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    delete process.env.DATABASE_URL
    vi.resetModules()
    await expect(import('./env')).rejects.toThrow()
  })

  it('skips validation when SKIP_ENV_VALIDATION is set', async () => {
    process.env.SKIP_ENV_VALIDATION = '1'
    delete process.env.DATABASE_URL
    vi.resetModules()
    const { env } = await import('./env')
    expect(env.DATABASE_URL).toBeUndefined()
  })
})
