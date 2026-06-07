import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signInAction, signOutAction } from './actions'

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

vi.mock('next/headers', () => ({
  headers: async () =>
    new Map([
      ['host', 'localhost:3000'],
      ['x-forwarded-proto', 'http'],
    ]),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_KEYCLOAK_ISSUER = 'http://localhost:8080/realms/polaris'
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
})
