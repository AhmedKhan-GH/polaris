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
  const { authConfig } = await import('./auth.config')

  const keycloak = authConfig.providers.find(
    (p) => (p as { id?: string }).id === 'keycloak',
  ) as { id?: string; options?: { issuer?: string } } | undefined

  expect(keycloak).toBeDefined()
  expect(keycloak?.options?.issuer).toBe(ENV.AUTH_KEYCLOAK_ISSUER)
})
