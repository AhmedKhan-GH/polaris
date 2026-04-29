import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
  signInWithPasswordMock,
  getServerSupabaseMock,
  redirectMock,
  infoMock,
  warnMock,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  getServerSupabaseMock: vi.fn(),
  redirectMock: vi.fn(),
  infoMock: vi.fn(),
  warnMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: getServerSupabaseMock,
}))

vi.mock('@/lib/log', () => ({
  log: {
    info: infoMock,
    warn: warnMock,
  },
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import { signInAction } from './actions'

function makeFormData(email: string, password: string) {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', password)
  return fd
}

describe('signInAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSupabaseMock.mockResolvedValue({
      auth: { signInWithPassword: signInWithPasswordMock },
    })
  })

  test('redirects to / and logs success on valid credentials', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    await signInAction({}, makeFormData('a@b.com', 'pw'))

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    })
    expect(infoMock).toHaveBeenCalledWith(
      { email: 'a@b.com', userId: 'user-1' },
      'login succeeded',
    )
    expect(redirectMock).toHaveBeenCalledWith('/')
    expect(warnMock).not.toHaveBeenCalled()
  })

  test('returns error state and warns on invalid credentials', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const result = await signInAction({}, makeFormData('a@b.com', 'wrong'))

    expect(result).toEqual({ error: 'Invalid login credentials' })
    expect(warnMock).toHaveBeenCalledWith(
      { email: 'a@b.com', reason: 'Invalid login credentials' },
      'login failed',
    )
    expect(redirectMock).not.toHaveBeenCalled()
    expect(infoMock).not.toHaveBeenCalled()
  })

  test('logs success without userId when supabase omits the user', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await signInAction({}, makeFormData('a@b.com', 'pw'))

    expect(infoMock).toHaveBeenCalledWith(
      { email: 'a@b.com', userId: undefined },
      'login succeeded',
    )
    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})
