import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LoginForm } from './LoginForm'

vi.mock('./actions', () => ({
  signInAction: vi.fn(),
}))

afterEach(cleanup)

describe('LoginForm', () => {
  test('renders a single Log in button and no credential fields', () => {
    render(<LoginForm />)

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })
})
