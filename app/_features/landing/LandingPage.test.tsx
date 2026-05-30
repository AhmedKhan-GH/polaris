import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LandingPage } from './LandingPage'

vi.mock('../auth/actions', () => ({
  signOutAction: vi.fn(),
}))

afterEach(cleanup)

describe('LandingPage', () => {
  test('shows log in button when unauthenticated', () => {
    render(<LandingPage user={null} />)

    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
  })

  test('shows dashboard link and log out button when authenticated', () => {
    render(<LandingPage user={{ id: '123' } as any} />)

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  test('does not show log in button when authenticated', () => {
    render(<LandingPage user={{ id: '123' } as any} />)

    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
  })
})
