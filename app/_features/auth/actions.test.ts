import { describe, expect, test, vi } from 'vitest'
import { signInAction } from './actions'
import { redirect } from 'next/navigation'

const signInWithPassword = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
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

  test('redirects to / on successful login', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null })

    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'correctpassword')

    await signInAction({ errors: {} }, formData)

    expect(redirect).toHaveBeenCalledWith('/')
  })
})
