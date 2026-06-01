import { describe, expect, test, vi } from 'vitest'
import { signInAction, signOutAction } from './actions'
import { redirect } from 'next/navigation'

const signInWithPassword = vi.fn()
const signOut = vi.fn()
const getUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { signInWithPassword, signOut, getUser },
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const insertValues = vi.fn().mockReturnValue({ values: vi.fn() })
vi.mock('@/lib/db/client', () => ({
  db: { insert: () => ({ values: insertValues }) },
}))

describe('signInAction', () => {
  test('returns validation error for empty email', async () => {
    const formData = new FormData()
    formData.set('email', '')
    formData.set('password', 'password123')

    const result = await signInAction({ errors: {} }, formData)

    expect(result.errors?.email).toBeDefined()
  })

  test('returns validation error for empty password', async () => {
    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', '')

    const result = await signInAction({ errors: {} }, formData)

    expect(result.errors?.password).toBeDefined()
  })

  test('returns error on invalid credentials', async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'wrongpassword')

    const result = await signInAction({ errors: {} }, formData)

    expect(result.errors?.form).toBeDefined()
  })

  test('redirects to /dashboard on successful login', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null })
    getUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } } })

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'correctpassword')

    await signInAction({ errors: {} }, formData)

    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('inserts sign-in log after successful login', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null })
    getUser.mockResolvedValueOnce({ data: { user: { id: 'user-456' } } })

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'correctpassword')

    await signInAction({ errors: {} }, formData)

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-456',
        createdAt: expect.any(Number),
      }),
    )
  })
})

describe('signOutAction', () => {
  test('calls supabase signOut', async () => {
    signOut.mockResolvedValueOnce({})

    await signOutAction()

    expect(signOut).toHaveBeenCalled()
  })

  test('redirects to landing page after sign out', async () => {
    signOut.mockResolvedValueOnce({})

    await signOutAction()

    expect(redirect).toHaveBeenCalledWith('/')
  })
})
