import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIG = { ...process.env }
const VALID = {
  AUTH_KEYCLOAK_ID: 'polaris-web',
  AUTH_KEYCLOAK_SECRET: 'secret',
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/polaris',
  AUTH_SECRET: 'auth-secret',
}

afterEach(() => {
  process.env = { ...ORIG }
  vi.resetModules()
})

describe('authEnv', () => {
  it('parses a valid auth environment', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    Object.assign(process.env, VALID)
    vi.resetModules()
    const { authEnv } = await import('./env-auth')
    expect(authEnv.AUTH_KEYCLOAK_ISSUER).toBe(VALID.AUTH_KEYCLOAK_ISSUER)
  })

  it('throws when a required auth var is missing', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    Object.assign(process.env, VALID)
    delete process.env.AUTH_KEYCLOAK_SECRET
    vi.resetModules()
    await expect(import('./env-auth')).rejects.toThrow()
  })

  it('throws when the issuer is not a URL', async () => {
    delete process.env.SKIP_ENV_VALIDATION
    Object.assign(process.env, VALID, { AUTH_KEYCLOAK_ISSUER: 'not-a-url' })
    vi.resetModules()
    await expect(import('./env-auth')).rejects.toThrow()
  })

  it('skips validation when SKIP_ENV_VALIDATION is set', async () => {
    process.env.SKIP_ENV_VALIDATION = '1'
    delete process.env.AUTH_KEYCLOAK_SECRET
    vi.resetModules()
    await expect(import('./env-auth')).resolves.toBeDefined()
  })
})
