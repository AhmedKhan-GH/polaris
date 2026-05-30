import { describe, expect, test, vi } from 'vitest'
import { signInAction } from './actions'

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      }),
    },
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
    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'wrongpassword')

    const result = await signInAction({ errors: {} }, formData)

    expect(result.errors?.form).toBeDefined()
  })
})
