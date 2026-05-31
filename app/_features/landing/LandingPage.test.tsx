import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { LandingPage } from './LandingPage'

vi.mock('../auth/actions', () => ({
  signOutAction: vi.fn(),
}))

afterEach(cleanup)

describe('LandingPage', () => {
  test('shows log in link in header when unauthenticated', () => {
    render(<LandingPage user={null} />)

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
  })

  test('shows log out button in header when authenticated', () => {
    render(<LandingPage user={{ id: '123' } as unknown as import('@supabase/supabase-js').User} />)

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  test('shows dashboard link in main content when authenticated', () => {
    render(<LandingPage user={{ id: '123' } as unknown as import('@supabase/supabase-js').User} />)

    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
  })

  test('does not show dashboard link when unauthenticated', () => {
    render(<LandingPage user={null} />)

    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })
})
