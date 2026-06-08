import { beforeEach, describe, expect, test, vi } from 'vitest'

const signIn = vi.fn()
const signOut = vi.fn()
const auth = vi.fn()

vi.mock('@/lib/auth', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  auth: (...args: unknown[]) => auth(...args),
}))

const redirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}))

const hdrs = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({ headers: async () => hdrs.map }))

vi.mock('@/lib/env-auth', () => ({
  authEnv: {
    AUTH_KEYCLOAK_ID: 'polaris-web',
    AUTH_KEYCLOAK_SECRET: 'secret',
    AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/polaris',
    AUTH_SECRET: 'auth-secret',
  },
}))

import { signInAction, signOutAction } from './actions'

beforeEach(() => {
  vi.clearAllMocks()
  hdrs.map = new Map([
    ['host', 'localhost:3000'],
    ['x-forwarded-proto', 'http'],
  ])
})

describe('signInAction', () => {
  test('starts Keycloak sign-in and redirects to /dashboard', async () => {
    await signInAction()

    expect(signIn).toHaveBeenCalledWith('keycloak', { redirectTo: '/dashboard' })
  })
})

describe('signOutAction', () => {
  test('clears the app session and redirects through the Keycloak end-session endpoint', async () => {
    auth.mockResolvedValueOnce({ idToken: 'id-tok-123' })

    await signOutAction()

    expect(signOut).toHaveBeenCalledWith({ redirect: false })

    const url = redirect.mock.calls[0]?.[0] as string
    expect(url).toContain(
      'http://localhost:8080/realms/polaris/protocol/openid-connect/logout',
    )
    expect(url).toContain('id_token_hint=id-tok-123')
    expect(url).toContain('post_logout_redirect_uri=')
  })

  test('constrains the redirect-origin scheme (a forged proto cannot inject javascript:)', async () => {
    auth.mockResolvedValueOnce({ idToken: 't' })
    hdrs.map = new Map([
      ['host', 'evil.example'],
      ['x-forwarded-proto', 'javascript'],
    ])

    await signOutAction()

    const url = redirect.mock.calls[0]?.[0] as string
    const redirectUri =
      new URL(url).searchParams.get('post_logout_redirect_uri') ?? ''
    expect(redirectUri.startsWith('http://')).toBe(true)
    expect(redirectUri).not.toContain('javascript:')
  })
})
