import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'
import { signInAction } from './actions'

vi.mock('./actions', () => ({
  signInAction: vi.fn().mockResolvedValue({ errors: {} }),
}))

afterEach(cleanup)

describe('LoginForm', () => {
  test('renders email and password fields with a submit button', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  test('displays validation errors returned by signInAction', async () => {
    vi.mocked(signInAction).mockResolvedValueOnce({
      errors: {
        email: ['Valid email is required'],
        password: ['Password is required'],
      },
    })

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Valid email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  test('renders back link to landing page', () => {
    render(<LoginForm />)

    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/')
  })

  test('displays form-level error on invalid credentials', async () => {
    vi.mocked(signInAction).mockResolvedValueOnce({
      errors: { form: ['Invalid login credentials'] },
    })

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })
})
