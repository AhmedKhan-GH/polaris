import { beforeEach, describe, expect, test, vi } from 'vitest'
import { signInAction, signOutAction } from './actions'

const signIn = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/auth', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signInAction', () => {
  test('starts Keycloak sign-in and redirects to /dashboard', async () => {
    await signInAction()

    expect(signIn).toHaveBeenCalledWith('keycloak', { redirectTo: '/dashboard' })
  })
})

describe('signOutAction', () => {
  test('signs out and redirects to the landing page', async () => {
    await signOutAction()

    expect(signOut).toHaveBeenCalledWith({ redirectTo: '/' })
  })
})
