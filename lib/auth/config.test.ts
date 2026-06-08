// @vitest-environment node
// (t3-env guards server-var access on the "client"; auth.config reads server env)
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const ENV = {
  AUTH_KEYCLOAK_ID: 'polaris-web',
  AUTH_KEYCLOAK_SECRET: 'polaris-dev-secret',
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/polaris',
  AUTH_SECRET: 'test-secret',
}

beforeEach(() => {
  Object.assign(process.env, ENV)
  vi.resetModules()
})

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key as keyof typeof ENV]
})

test('registers a keycloak provider using the issuer from env', async () => {
  const { authConfig } = await import('./config')

  const keycloak = authConfig.providers.find(
    (p) => (p as { id?: string }).id === 'keycloak',
  ) as { id?: string; options?: { issuer?: string } } | undefined

  expect(keycloak).toBeDefined()
  expect(keycloak?.options?.issuer).toBe(ENV.AUTH_KEYCLOAK_ISSUER)
})

test('throws when a required Keycloak env var is missing', async () => {
  delete process.env.AUTH_KEYCLOAK_ID
  vi.resetModules()
  await expect(import('./config')).rejects.toThrow()
})

test('throws when the Keycloak issuer is not a URL', async () => {
  process.env.AUTH_KEYCLOAK_ISSUER = 'not-a-url'
  vi.resetModules()
  await expect(import('./config')).rejects.toThrow()
})

test('maps the Keycloak roles claim into the session', async () => {
  const { authConfig } = await import('./config')
  const callbacks = authConfig.callbacks!

  const token = await callbacks.jwt!({
    token: {},
    account: null,
    profile: { roles: ['owner'] },
  } as unknown as Parameters<NonNullable<typeof callbacks.jwt>>[0])

  const session = await callbacks.session!({
    session: { user: {}, expires: '' },
    token,
  } as unknown as Parameters<NonNullable<typeof callbacks.session>>[0])

  expect((session as { roles?: string[] }).roles).toEqual(['owner'])
})

test('hardens a malformed roles claim to an empty array (not a raw value)', async () => {
  const { authConfig } = await import('./config')
  const callbacks = authConfig.callbacks!

  const token = await callbacks.jwt!({
    token: {},
    account: null,
    profile: { roles: 'owner' }, // string, not string[] — malformed
  } as unknown as Parameters<NonNullable<typeof callbacks.jwt>>[0])

  const session = await callbacks.session!({
    session: { user: {}, expires: '' },
    token,
  } as unknown as Parameters<NonNullable<typeof callbacks.session>>[0])

  expect((session as { roles?: string[] }).roles).toEqual([])
})

test('maps the Keycloak sub into the session as userId', async () => {
  const { authConfig } = await import('./config')
  const callbacks = authConfig.callbacks!

  const token = await callbacks.jwt!({
    token: {},
    account: { providerAccountId: 'kc-sub-123' },
    profile: { sub: 'kc-sub-123' },
  } as unknown as Parameters<NonNullable<typeof callbacks.jwt>>[0])

  const session = await callbacks.session!({
    session: { user: {}, expires: '' },
    token,
  } as unknown as Parameters<NonNullable<typeof callbacks.session>>[0])

  expect((session as { userId?: string }).userId).toBe('kc-sub-123')
})
