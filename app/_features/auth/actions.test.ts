import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
  signInMock,
  signOutMock,
  getUserMock,
  getServerSupabaseMock,
  redirectMock,
  insertMock,
  valuesMock,
  infoMock,
  warnMock,
  errorMock,
} = vi.hoisted(() => {
  const valuesMock = vi.fn().mockResolvedValue(undefined)
  return {
    signInMock: vi.fn(),
    signOutMock: vi.fn(),
    getUserMock: vi.fn(),
    getServerSupabaseMock: vi.fn(),
    redirectMock: vi.fn(),
    insertMock: vi.fn(() => ({ values: valuesMock })),
    valuesMock,
    infoMock: vi.fn(),
    warnMock: vi.fn(),
    errorMock: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: getServerSupabaseMock,
  getServiceRoleSupabase: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: infoMock, warn: warnMock, error: errorMock },
}))
vi.mock('@/lib/db/client', () => ({ db: { insert: insertMock } }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import { signInAction, signOutAction } from './actions'

function fd(email: string, password: string) {
  const f = new FormData()
  f.set('email', email)
  f.set('password', password)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  getServerSupabaseMock.mockResolvedValue({
    auth: {
      signInWithPassword: signInMock,
      signOut: signOutMock,
      getUser: getUserMock,
    },
  })
})

describe('signInAction', () => {
  test('valid credentials: logs sign-in, writes sign_in_log, redirects /dashboard', async () => {
    signInMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    await signInAction({}, fd('a@b.com', 'pw'))
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
    expect(valuesMock).toHaveBeenCalledWith({ userId: 'u1', email: 'a@b.com' })
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
    expect(warnMock).not.toHaveBeenCalled()
  })

  test('bad credentials: returns error state, no redirect', async () => {
    signInMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    const r = await signInAction({}, fd('a@b.com', 'x'))
    expect(r).toEqual({ error: 'Invalid login credentials' })
    expect(redirectMock).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalled()
  })

  test('invalid input: returns a validation error without calling Supabase', async () => {
    const r = await signInAction({}, fd('not-an-email', ''))
    expect(r.error).toBeTruthy()
    expect(signInMock).not.toHaveBeenCalled()
  })
})

describe('signOutAction', () => {
  test('signs out and redirects to / with no Keycloak end-session', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    await signOutAction()
    expect(signOutMock).toHaveBeenCalled()
    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})
